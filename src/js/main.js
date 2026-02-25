import { Calendar } from './components/calendar.js';

document.addEventListener('DOMContentLoaded', () => {

    // 임시 데이터 (나중에 Firebase에서 가져올 데이터)
    const mockEvents = {
        '2026-02-14': [
            { id: '1', title: '발렌타인데이 데이트', time: '19:00', assignee: 'both', memo: '기념일 저녁 식사', alerts: [60] }
        ],
        '2026-02-25': [
            { id: '2', title: '병원 예약', time: '14:00', assignee: 'husband', memo: '내과 정기검진', alerts: [10, 60] },
            { id: '3', title: '마트 장보기', time: '18:00', assignee: 'wife', memo: '저녁거리 사기', alerts: [0] }
        ],
        '2026-02-28': [
            { id: '4', title: '가족 모임', time: '12:00', assignee: 'both', memo: '', alerts: [60] }
        ]
    };

    // DOM 요소
    const eventsList = document.getElementById('eventsList');
    const selectedDateDisplay = document.getElementById('selectedDateDisplay');
    const fabAddEvent = document.getElementById('fabAddEvent');
    const eventModal = document.getElementById('eventModal');
    const btnCancelEvent = document.getElementById('btnCancelEvent');
    const eventForm = document.getElementById('eventForm');

    // 날짜 선택 시 하단 일정 목록 렌더링
    const handleDateSelect = (dateStr, dateObj) => {
        // 요일 구하기
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = weekDays[dateObj.getDay()];

        // 포맷: 2월 25일 (수)
        selectedDateDisplay.textContent = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayName})`;

        // 리스트 비우기
        eventsList.innerHTML = '';

        const dayEvents = mockEvents[dateStr] || [];

        if (dayEvents.length === 0) {
            eventsList.innerHTML = '<li class="empty-state">선택한 날짜의 일정이 없습니다.</li>';
            return;
        }

        // 시간순 정렬
        dayEvents.sort((a, b) => a.time.localeCompare(b.time));

        dayEvents.forEach(evt => {
            const li = document.createElement('li');
            li.className = `event-item ${evt.assignee}`;

            li.innerHTML = `
         <div class="event-indicator"></div>
         <div class="event-time">${evt.time}</div>
         <div class="event-details">
           <div class="event-title">${evt.title}</div>
           ${evt.memo ? `<div class="event-memo">${evt.memo}</div>` : ''}
         </div>
         ${evt.assignee === 'both' ? '<span class="event-badget">가족</span>' :
                    evt.assignee === 'husband' ? '<span class="event-badget">남편</span>' : '<span class="event-badget">아내</span>'}
       `;
            eventsList.appendChild(li);
        });
    };

    // 초기에 달력 인스턴스 생성 및 렌더링
    const calendar = new Calendar('calendarGrid', handleDateSelect);

    // 데이터 주입 (달력에 점 찍기 위함)
    calendar.setEvents(mockEvents);

    // 첫 화면은 오늘 날짜 선택한 상태로 초기화 로직
    // date-fns의 format 활용을 위해 수동 선택 트리거 (임시)
    const todayStr = new Date().toISOString().split('T')[0];
    handleDateSelect(todayStr, new Date());

    // === 모달 제어 ===
    const openModal = () => {
        eventModal.classList.add('show');
        // 사용자가 선택해둔 날짜를 모달 입력폼 기본값으로 세팅 (로컬 시간 기준 yyyy-MM-dd)
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(calendar.selectedDate - tzoffset)).toISOString().slice(0, 10);
        document.getElementById('eventDate').value = localISOTime;
    };

    const closeModal = () => {
        eventModal.classList.remove('show');
        eventForm.reset();
    };

    fabAddEvent.addEventListener('click', openModal);
    btnCancelEvent.addEventListener('click', closeModal);

    // 모달 바깥 배경 클릭 시 닫기
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) closeModal();
    });

    // 폼 제출(일정 저장) 시 기본 동작 막기
    eventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('저장 버튼 클릭됨 (Firebase 연동 단계에서 실제 저장 로직 구현 예정)');
        closeModal();
    });
});
