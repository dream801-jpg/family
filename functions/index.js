const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

/**
 * 5분마다 실행되는 스케줄러
 * - 오늘 일정 중 알림 시각이 현재~5분 이내인 것을 찾아서 푸시 전송
 */
exports.sendScheduledNotifications = onSchedule(
    {
        schedule: "every 5 minutes",
        timeZone: "Asia/Seoul",
        region: "asia-northeast3", // 서울 리전
    },
    async (event) => {
        const db = getDatabase();
        const now = new Date();

        // 한국 시간으로 변환
        const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

        // 오늘 날짜 (yyyy-MM-dd)
        const todayStr = koreaTime.getFullYear() + '-' +
            String(koreaTime.getMonth() + 1).padStart(2, '0') + '-' +
            String(koreaTime.getDate()).padStart(2, '0');

        const currentMinutes = koreaTime.getHours() * 60 + koreaTime.getMinutes();

        // 1) 모든 이벤트 가져오기
        const eventsSnap = await db.ref("events").once("value");
        const events = eventsSnap.val();
        if (!events) return;

        // 2) 오늘 이벤트 중 알림 발송할 것 필터링
        const notificationsToSend = [];

        Object.entries(events).forEach(([id, evt]) => {
            if (evt.date !== todayStr) return;
            if (!evt.alerts || evt.alerts.length === 0) return;
            if (!evt.time) return;

            const [hours, minutes] = evt.time.split(":").map(Number);
            const eventMinutes = hours * 60 + minutes;

            evt.alerts.forEach((alertMin) => {
                const alertAtMinutes = eventMinutes - alertMin;
                // 현재 시각이 알림 시각 범위 내인지 확인 (±2.5분 여유)
                if (alertAtMinutes >= currentMinutes - 2 && alertAtMinutes <= currentMinutes + 2) {
                    const alertLabel = alertMin === 0 ? "지금 시작" :
                        alertMin < 60 ? `${alertMin}분 후 시작` :
                            `${Math.floor(alertMin / 60)}시간 후 시작`;

                    const assigneeEmoji = evt.assignee === 'both' ? '👨‍👩‍👧' :
                        evt.assignee === 'husband' ? '🔵' : '🔴';

                    notificationsToSend.push({
                        title: `${assigneeEmoji} ${evt.title}`,
                        body: `${alertLabel} (${evt.time})${evt.memo ? '\n' + evt.memo : ''}`
                    });
                }
            });
        });

        if (notificationsToSend.length === 0) return;

        // 3) FCM 토큰 가져오기
        const tokensSnap = await db.ref("fcmTokens").once("value");
        const tokensData = tokensSnap.val();
        if (!tokensData) return;

        const tokens = Object.values(tokensData).map((t) => t.token);
        if (tokens.length === 0) return;

        // 4) 모든 디바이스에 알림 전송
        const messaging = getMessaging();

        for (const notif of notificationsToSend) {
            const message = {
                notification: {
                    title: notif.title,
                    body: notif.body,
                },
                webpush: {
                    notification: {
                        icon: "/pwa-192x192.png",
                        badge: "/pwa-192x192.png",
                        vibrate: [200, 100, 200],
                        requireInteraction: true,
                    },
                },
                tokens: tokens,
            };

            try {
                const response = await messaging.sendEachForMulticast(message);
                console.log(`✅ 알림 전송: "${notif.title}" → 성공 ${response.successCount}, 실패 ${response.failureCount}`);

                // 만료된 토큰 정리
                if (response.failureCount > 0) {
                    response.responses.forEach((resp, idx) => {
                        if (resp.error) {
                            const failedToken = tokens[idx];
                            // 만료된 토큰 DB에서 삭제
                            db.ref(`fcmTokens/${failedToken.substring(0, 20)}`).remove();
                        }
                    });
                }
            } catch (err) {
                console.error("알림 전송 실패:", err);
            }
        }
    }
);
