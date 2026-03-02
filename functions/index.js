const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

/**
 * 5분마다 실행되는 스케줄러
 * - 오늘 일정 중 알림 시각이 현재~5분 이내인 것을 찾아서 푸시 전송
 * - 담당자별 필터링: 각 기기 설정에 따라 해당되는 알림만 전송
 */
exports.sendScheduledNotifications = onSchedule(
    {
        schedule: "every 5 minutes",
        timeZone: "Asia/Seoul",
        region: "asia-northeast3",
    },
    async (event) => {
        const db = getDatabase();
        const now = new Date();

        const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
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
                if (alertAtMinutes >= currentMinutes - 2 && alertAtMinutes <= currentMinutes + 2) {
                    const alertLabel = alertMin === 0 ? "지금 시작" :
                        alertMin < 60 ? `${alertMin}분 후 시작` :
                            `${Math.floor(alertMin / 60)}시간 후 시작`;

                    const assigneeEmoji = evt.assignee === 'both' ? '👨‍👩‍👧' :
                        evt.assignee === 'husband' ? '🔵' : '🔴';

                    notificationsToSend.push({
                        title: `${assigneeEmoji} ${evt.title}`,
                        body: `${alertLabel} (${evt.time})${evt.memo ? '\n' + evt.memo : ''}`,
                        assignee: evt.assignee || 'both'
                    });
                }
            });
        });

        if (notificationsToSend.length === 0) return;

        // 3) FCM 토큰 + 기기 설정 가져오기
        const [tokensSnap, settingsSnap] = await Promise.all([
            db.ref("fcmTokens").once("value"),
            db.ref("deviceSettings").once("value")
        ]);

        const tokensData = tokensSnap.val();
        const settingsData = settingsSnap.val() || {};
        if (!tokensData) return;

        const tokenEntries = Object.values(tokensData);
        if (tokenEntries.length === 0) return;

        const messaging = getMessaging();

        // 4) 각 알림마다 해당하는 기기에만 전송
        for (const notif of notificationsToSend) {
            // 각 토큰별로 필터링
            const targetTokens = [];

            for (const entry of tokenEntries) {
                const deviceId = entry.deviceId;
                const deviceSettings = deviceId ? settingsData[deviceId] : null;

                let shouldSend = true;

                if (deviceSettings) {
                    const myRole = deviceSettings.role; // 'husband' or 'wife'
                    const eventAssignee = notif.assignee; // 'husband', 'wife', or 'both'

                    if (eventAssignee === 'both') {
                        // 가족 공통 일정 → filterFamily 체크
                        shouldSend = deviceSettings.filterFamily !== false;
                    } else if (eventAssignee === myRole) {
                        // 내 일정 → filterMine 체크
                        shouldSend = deviceSettings.filterMine !== false;
                    } else {
                        // 상대방 일정 → filterPartner 체크
                        shouldSend = deviceSettings.filterPartner === true;
                    }
                }

                if (shouldSend) {
                    targetTokens.push({
                        token: entry.token,
                        notifMode: deviceSettings?.notifMode || 'sound'
                    });
                }
            }

            if (targetTokens.length === 0) continue;

            // 알림 모드별로 그룹핑하여 전송
            const modeGroups = {};
            targetTokens.forEach(t => {
                if (!modeGroups[t.notifMode]) modeGroups[t.notifMode] = [];
                modeGroups[t.notifMode].push(t.token);
            });

            for (const [mode, tokens] of Object.entries(modeGroups)) {
                // 알림 모드에 따른 Android 알림 설정
                let androidConfig = {};
                if (mode === 'sound') {
                    androidConfig = {
                        notification: {
                            sound: 'default',
                            channelId: 'calendar_sound',
                            priority: 'high'
                        }
                    };
                } else if (mode === 'vibrate') {
                    androidConfig = {
                        notification: {
                            sound: '',
                            channelId: 'calendar_vibrate',
                            priority: 'high'
                        }
                    };
                } else {
                    // silent - 화면만
                    androidConfig = {
                        notification: {
                            sound: '',
                            channelId: 'calendar_silent',
                            priority: 'default'
                        }
                    };
                }

                const message = {
                    notification: {
                        title: notif.title,
                        body: notif.body,
                    },
                    android: androidConfig,
                    tokens: tokens,
                };

                try {
                    const response = await messaging.sendEachForMulticast(message);
                    console.log(`✅ [${mode}] "${notif.title}" → 성공 ${response.successCount}, 실패 ${response.failureCount}`);

                    if (response.failureCount > 0) {
                        response.responses.forEach((resp, idx) => {
                            if (resp.error) {
                                const failedToken = tokens[idx];
                                db.ref(`fcmTokens/${failedToken.substring(0, 20)}`).remove();
                            }
                        });
                    }
                } catch (err) {
                    console.error("알림 전송 실패:", err);
                }
            }
        }
    }
);
