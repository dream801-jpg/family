// Firebase Messaging Service Worker
// 이 파일은 반드시 루트(public/)에 위치해야 합니다.

importScripts('https://www.gstatic.com/firebasejs/11.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAJvshPxu92fKbasnz9nZ0vpJxUar3sxh0",
    authDomain: "yoonmood-ea878.firebaseapp.com",
    databaseURL: "https://yoonmood-ea878-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "yoonmood-ea878",
    storageBucket: "yoonmood-ea878.firebasestorage.app",
    messagingSenderId: "915823424141",
    appId: "1:915823424141:web:6989b2ee3a007577f168c4"
});

const messaging = firebase.messaging();

// 백그라운드 메시지 수신 시 알림 표시
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 백그라운드 메시지 수신:', payload);

    const title = payload.notification?.title || '우리가족 캘린더';
    const options = {
        body: payload.notification?.body || '새로운 알림이 있습니다.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: payload.data
    };

    self.registration.showNotification(title, options);
});

// 알림 클릭 시 앱으로 이동
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 이미 열린 탭이 있으면 포커스
            for (const client of clientList) {
                if (client.url.includes('yoonmood-ea878') && 'focus' in client) {
                    return client.focus();
                }
            }
            // 없으면 새 탭 열기
            return clients.openWindow('/');
        })
    );
});
