/**
 * 알림 서비스 (Notification Service)
 * 
 * 앱이 열려있을 때 일정 시간에 맞춰 웹 알림을 보내는 서비스.
 * PWA로 설치하면 스마트폰에서도 알림이 울립니다.
 */

let notificationPermission = 'default';
let scheduledTimers = []; // 현재 예약된 setTimeout ID들
let allEventsCache = {}; // 이벤트 캐시

/**
 * 알림 권한 요청
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('이 브라우저는 알림을 지원하지 않습니다.');
        return false;
    }

    if (Notification.permission === 'granted') {
        notificationPermission = 'granted';
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notificationPermission = permission;
        return permission === 'granted';
    }

    return false;
}

/**
 * 알림 보내기
 */
function showNotification(title, body, tag) {
    if (notificationPermission !== 'granted') return;

    // Service Worker가 등록되어 있으면 SW를 통해 알림 표시 (백그라운드 지원)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
                body,
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                tag, // 같은 tag의 알림은 중복 방지
                vibrate: [200, 100, 200],
                requireInteraction: true, // 사용자가 직접 닫을 때까지 유지
                actions: [
                    { action: 'open', title: '열기' },
                    { action: 'close', title: '닫기' }
                ]
            });
        });
    } else {
        // SW 없으면 일반 Notification API 사용
        new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
            tag,
        });
    }
}

/**
 * 오늘의 알림 스케줄링
 * - 모든 타이머를 초기화하고, 오늘 남은 일정에 대해 setTimeout 예약
 */
export function scheduleNotifications(eventsMap) {
    // 기존 타이머 모두 취소
    scheduledTimers.forEach(id => clearTimeout(id));
    scheduledTimers = [];
    allEventsCache = eventsMap;

    if (notificationPermission !== 'granted') return;

    const now = new Date();
    const todayStr = formatDateStr(now);

    // 오늘 일정만 확인
    const todayEvents = eventsMap[todayStr] || [];

    todayEvents.forEach(evt => {
        if (!evt.alerts || evt.alerts.length === 0) return;
        if (!evt.time) return;

        // 이벤트 시간 파싱
        const [hours, minutes] = evt.time.split(':').map(Number);
        const eventTime = new Date(now);
        eventTime.setHours(hours, minutes, 0, 0);

        evt.alerts.forEach(alertMinutes => {
            // 알림 시각 = 이벤트 시각 - alertMinutes분
            const alertTime = new Date(eventTime.getTime() - alertMinutes * 60 * 1000);
            const delay = alertTime.getTime() - now.getTime();

            // 이미 지난 시간이면 무시
            if (delay < 0) return;

            const timerId = setTimeout(() => {
                const alertLabel = alertMinutes === 0 ? '지금' :
                    alertMinutes < 60 ? `${alertMinutes}분 후` :
                        `${alertMinutes / 60}시간 후`;

                const assigneeLabel = evt.assignee === 'both' ? '👨‍👩‍👧' :
                    evt.assignee === 'husband' ? '🔵' : '🔴';

                showNotification(
                    `${assigneeLabel} ${evt.title}`,
                    `${alertLabel} 시작 (${evt.time})${evt.memo ? '\n' + evt.memo : ''}`,
                    `event-${evt.id}-${alertMinutes}`
                );
            }, delay);

            scheduledTimers.push(timerId);
        });
    });

    console.log(`📅 오늘 알림 ${scheduledTimers.length}개 예약됨`);
}

/**
 * 매일 자정에 다시 스케줄링 (날짜 바뀔 때)
 */
export function startDailyScheduler(eventsMap) {
    // 즉시 오늘 스케줄링
    scheduleNotifications(eventsMap);

    // 다음 자정까지 남은 시간 계산
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 5, 0); // 자정 + 5초 (여유)
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // 자정에 다시 스케줄링
    setTimeout(() => {
        scheduleNotifications(allEventsCache);
        // 재귀적으로 다음날도 예약
        startDailyScheduler(allEventsCache);
    }, msUntilMidnight);
}

/**
 * 날짜를 yyyy-MM-dd 형식 문자열로 변환
 */
function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
