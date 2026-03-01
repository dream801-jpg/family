import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, remove, update } from 'firebase/database';

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

// === 일정 데이터 서비스 ===

/**
 * 모든 일정 실시간 구독
 * @param {Function} callback - 데이터 변경 시 호출될 콜백 (eventsMap 전달)
 * @returns {Function} unsubscribe 함수
 */
export function subscribeEvents(callback) {
  const eventsRef = ref(db, 'events');
  const unsubscribe = onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    // Firebase 데이터를 날짜별 Map으로 변환
    // { '2026-02-25': [{ id, title, time, assignee, memo, alerts }, ...] }
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

export { db };
