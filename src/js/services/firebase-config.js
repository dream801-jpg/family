import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, remove, update } from 'firebase/database';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAJvshPxu92fKbasnz9nZ0vpJxUar3sxh0",
  authDomain: "yoonmood-ea878.firebaseapp.com",
  databaseURL: "https://yoonmood-ea878-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "yoonmood-ea878",
  storageBucket: "yoonmood-ea878.firebasestorage.app",
  messagingSenderId: "915823424141",
  appId: "1:915823424141:web:6989b2ee3a007577f168c4",
  measurementId: "G-XZ54VVPNBH"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const messaging = getMessaging(app);

// === FCM 푸시 알림 ===

/**
 * FCM 토큰 저장 (디바이스 등록)
 * - 알림 권한 허용 후 호출
 * - 토큰을 DB에 저장하면 Cloud Functions가 이 토큰으로 푸시를 보냄
 */
export async function saveFcmToken() {
  try {
    const token = await getToken(messaging, {
      vapidKey: '' // VAPID 키는 Firebase 콘솔에서 생성 후 입력 필요
    });
    if (token) {
      // 토큰을 DB에 저장 (기기별 고유 토큰)
      await set(ref(db, `fcmTokens/${token.substring(0, 20)}`), {
        token,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ FCM 토큰 저장 완료');
      return token;
    }
  } catch (err) {
    console.error('FCM 토큰 등록 실패:', err);
  }
  return null;
}

/**
 * 포그라운드 메시지 수신 핸들러
 */
export function onForegroundMessage(callback) {
  onMessage(messaging, (payload) => {
    callback(payload);
  });
}

// === 일정 데이터 서비스 ===

/**
 * 모든 일정 실시간 구독
 */
export function subscribeEvents(callback) {
  const eventsRef = ref(db, 'events');
  const unsubscribe = onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    const eventsMap = {};
    if (data) {
      Object.entries(data).forEach(([id, evt]) => {
        const dateKey = evt.date;
        if (!eventsMap[dateKey]) eventsMap[dateKey] = [];
        eventsMap[dateKey].push({ id, ...evt });
      });
    }
    callback(eventsMap);
  });
  return unsubscribe;
}

/**
 * 일정 추가
 */
export function addEvent(eventData) {
  const eventsRef = ref(db, 'events');
  return push(eventsRef, eventData);
}

/**
 * 일정 수정
 */
export function updateEvent(eventId, eventData) {
  const eventRef = ref(db, `events/${eventId}`);
  return update(eventRef, eventData);
}

/**
 * 일정 삭제
 */
export function deleteEvent(eventId) {
  const eventRef = ref(db, `events/${eventId}`);
  return remove(eventRef);
}

export { db, messaging };

