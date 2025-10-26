// Background Location Tracker for Mobile App
class BackgroundTracker {
    constructor() {
        this.isMobileApp = false;
        this.isTracking = false;
        this.init();
    }

    async init() {
        // Check if we're in a Capacitor app
        if (typeof Capacitor !== 'undefined') {
            this.isMobileApp = true;
            await this.setupMobileTracking();
        } else {
            this.setupWebTracking();
        }
    }

    async setupMobileTracking() {
        console.log('Setting up mobile background tracking...');
        
        try {
            // Request permissions
            const permissions = await BackgroundGeolocation.checkPermissions();
            
            if (permissions.location !== 'granted') {
                const newPermissions = await BackgroundGeolocation.requestPermissions();
                if (newPermissions.location !== 'granted') {
                    console.log('Location permission denied');
                    return;
                }
            }

            // Configure background geolocation
            await BackgroundGeolocation.configure({
                desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
                distanceFilter: 10, // meters
                stopOnTerminate: false, // Continue when app closed
                startOnBoot: true,    // Start on device reboot
                interval: 30000,      // 30 seconds
                fastestInterval: 15000,
                activitiesInterval: 10000,
                notificationTitle: 'SafeLink',
                notificationText: 'Location tracking active',
                notificationIcon: 'ic_launcher', // Make sure this icon exists
                notificationIconColor: '#3B82F6',
                debug: false // Set to true for development
            });

            // Start tracking
            await BackgroundGeolocation.start();
            this.isTracking = true;
            
            console.log('Mobile background tracking started');

            // Listen for location updates
            BackgroundGeolocation.on('location', (location) => {
                this.handleMobileLocation(location);
            });

            // Listen for errors
            BackgroundGeolocation.on('error', (error) => {
                console.error('Background location error:', error);
            });

        } catch (error) {
            console.error('Mobile tracking setup failed:', error);
        }
    }

    setupWebTracking() {
        console.log('Setting up web tracking...');
        
        // Use the existing web geolocation API
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        };

        // Start watching position
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleWebLocation(position),
            (error) => this.handleLocationError(error),
            options
        );

        this.isTracking = true;
    }

    async handleMobileLocation(location) {
        const user = auth.currentUser;
        if (!user) return;

        const locationData = {
            userId: user.uid,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            speed: location.speed || 0,
            heading: location.bearing || 0,
            altitude: location.altitude || 0,
            isBackground: true,
            provider: location.provider,
            timestamp: new Date(location.time)
        };

        await this.saveLocationToFirestore(locationData);
        
        // Check geofences in background
        await this.checkGeofences(locationData);
    }

    handleWebLocation(position) {
        const user = auth.currentUser;
        if (!user) return;

        const locationData = {
            userId: user.uid,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || 0,
            altitude: position.coords.altitude || 0,
            isBackground: false,
            timestamp: new Date()
        };

        this.saveLocationToFirestore(locationData);
        this.checkGeofences(locationData);
    }

    async saveLocationToFirestore(location) {
        try {
            await db.collection('locations').add({
                ...location,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('Location saved to Firebase');
        } catch (error) {
            console.error('Error saving location:', error);
        }
    }

    async checkGeofences(location) {
        // Get user's geofences
        const geofencesSnapshot = await db.collection('geofences')
            .where('userId', '==', location.userId)
            .where('isActive', '==', true)
            .get();

        geofencesSnapshot.forEach(async (doc) => {
            const geofence = doc.data();
            const distance = this.calculateDistance(
                location.latitude, location.longitude,
                geofence.latitude, geofence.longitude
            );

            const wasInside = geofence.lastStatus === 'inside';
            const isInside = distance <= geofence.radius_metres;

            // Check for boundary crossing
            if (wasInside !== isInside) {
                const alertType = isInside ? 'entry' : 'exit';
                const message = isInside ? 
                    `Entered ${geofence.name} zone` : 
                    `Left ${geofence.name} zone`;

                await this.createAlert(location.userId, doc.id, alertType, message);
                
                // Update geofence status
                await db.collection('geofences').doc(doc.id).update({
                    lastStatus: isInside ? 'inside' : 'outside',
                    lastStatusUpdate: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Send push notification
                if (this.isMobileApp) {
                    this.sendPushNotification(message);
                }
            }
        });
    }

    async createAlert(userId, geofenceId, type, message) {
        try {
            await db.collection('alerts').add({
                userId: userId,
                geofenceId: geofenceId,
                alertType: type,
                message: message,
                latitude: location.latitude,
                longitude: location.longitude,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isRead: false
            });
        } catch (error) {
            console.error('Error creating alert:', error);
        }
    }

    async sendPushNotification(message) {
        if (!this.isMobileApp) return;

        try {
            await PushNotifications.createChannel({
                id: 'safelink-alerts',
                name: 'SafeLink Alerts',
                description: 'Geofencing alert notifications',
                importance: 4, // High importance
                vibration: true
            });

            await PushNotifications.requestPermissions();
            
            await PushNotifications.schedule({
                notifications: [
                    {
                        id: Date.now(),
                        title: 'SafeLink Alert',
                        body: message,
                        channelId: 'safelink-alerts',
                        sound: 'default',
                        attachments: null
                    }
                ]
            });
        } catch (error) {
            console.error('Push notification error:', error);
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    handleLocationError(error) {
        console.error('Location error:', error);
        
        let message = 'Location tracking error: ';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'Permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'Position unavailable';
                break;
            case error.TIMEOUT:
                message += 'Request timeout';
                break;
            default:
                message += 'Unknown error';
        }
        
        // You could save this error to Firebase for monitoring
        console.error(message);
    }

    async stopTracking() {
        if (this.isMobileApp && this.isTracking) {
            await BackgroundGeolocation.stop();
        } else if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        this.isTracking = false;
        console.log('Location tracking stopped');
    }
}

// Initialize background tracker
const backgroundTracker = new BackgroundTracker();