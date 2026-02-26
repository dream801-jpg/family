import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    parseISO
} from 'date-fns';

export class Calendar {
    constructor(containerId, onDateSelected) {
        this.container = document.getElementById(containerId);
        this.currentDate = new Date();
        this.selectedDate = new Date(); // 초기는 오늘
        this.onDateSelected = onDateSelected;
        this.events = {}; // { '2026-02-25': [{...}, {...}] } 형태로 주입받음

        this.initDOM();
    }

    initDOM() {
        this.monthYearDisplay = document.getElementById('currentMonthYear');
        this.btnPrev = document.getElementById('prevMonth');
        this.btnNext = document.getElementById('nextMonth');

        this.btnPrev.addEventListener('click', () => this.changeMonth(-1));
        this.btnNext.addEventListener('click', () => this.changeMonth(1));
    }

    setEvents(eventsData) {
        this.events = eventsData;
        this.render(); // 이벤트 데이터 주입 후 다시 그리기
    }

    changeMonth(offset) {
        if (offset === 1) {
            this.currentDate = addMonths(this.currentDate, 1);
        } else {
            this.currentDate = subMonths(this.currentDate, 1);
        }
        this.render();
    }

    render() {
        // 1. 헤더 업데이트 (예: 2026. 02)
        this.monthYearDisplay.textContent = format(this.currentDate, 'yyyy. MM');

        // 2. 달력 그리드 비우기
        this.container.innerHTML = '';

        // 3. 날짜 계산 (현재 월의 첫 주 일요일부터 마지막 주 토요일까지)
        const monthStart = startOfMonth(this.currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart); // 일요일부터 시작
        const endDate = endOfWeek(monthEnd);

        // 날짜 배열 생성
        const dateFormat = 'd';
        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = '';

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const cloneDay = day;
                const _dateStr = format(cloneDay, 'yyyy-MM-dd');

                // 셀 생성
                const cell = document.createElement('div');
                cell.className = 'calendar-day';

                // 이번 달 날짜가 아니면 안 보이거나 흐리게 처리
                if (!isSameMonth(day, monthStart)) {
                    cell.classList.add('empty');
                } else {
                    // 일요일/토요일 색상 클래스
                    if (i === 0) cell.classList.add('sunday');
                    if (i === 6) cell.classList.add('saturday');

                    // 오늘 표시
                    if (isSameDay(day, new Date())) {
                        cell.classList.add('today');
                    }

                    // 선택된 날짜 표시 (오늘이거나 사용자가 누른 셀)
                    if (isSameDay(day, this.selectedDate)) {
                        cell.classList.add('selected');
                    }

                    // 클릭 이벤트
                    cell.addEventListener('click', () => {
                        // 기존 선택 셀 해제
                        const prevSelected = document.querySelector('.calendar-day.selected');
                        if (prevSelected) prevSelected.classList.remove('selected');
                        // 새 셀 선택
                        cell.classList.add('selected');
                        this.selectedDate = cloneDay;

                        // 콜백 실행 (일정 목록 업데이트 등)
                        if (this.onDateSelected) {
                            this.onDateSelected(_dateStr, cloneDay);
                        }
                    });
                }

                // 날짜 숫자 태그
                const span = document.createElement('span');
                span.className = 'day-number';
                span.textContent = format(day, dateFormat);
                cell.appendChild(span);

                // 일정 도트(Dot) 렌더링
                if (this.events[_dateStr] && this.events[_dateStr].length > 0) {
                    const dotsContainer = document.createElement('div');
                    dotsContainer.className = 'events-dots';

                    // 최대 3개까지만 도트 표시
                    const displayEvents = this.events[_dateStr].slice(0, 3);
                    displayEvents.forEach(evt => {
                        const dot = document.createElement('div');
                        dot.className = `dot ${evt.assignee}`; // husband, wife, both
                        dotsContainer.appendChild(dot);
                    });
                    cell.appendChild(dotsContainer);
                }

                days.push(cell);
                day = addDays(day, 1);
            }

            // 일주일치(7일) 모아서 컨테이너에 추가
            days.forEach(d => this.container.appendChild(d));
            days = [];
        }
    }
}
