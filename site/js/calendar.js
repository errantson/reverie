/**
 * Reverie House Calendar Widget
 * Custom date/time picker with bespoke styling
 */

class CalendarWidget {
    constructor() {
        this.selectedDate = null;
        this.selectedTime = { hour: 12, minute: 0, meridiem: 'PM' };
        this.currentMonth = new Date();
        this.onSelect = null;
        this.overlay = null;
        this.container = null;
    }

    /**
     * Show calendar picker
     * @param {Date} initialDate - Initial date to display
     * @param {Function} callback - Called when date/time selected (timestamp)
     */
    show(initialDate = null, callback = null) {
        console.log('📅 [CalendarWidget] show() called with:', { initialDate, hasCallback: !!callback });
        this.onSelect = callback;
        
        if (initialDate) {
            this.selectedDate = new Date(initialDate);
            this.currentMonth = new Date(initialDate);
            const hours = initialDate.getHours();
            this.selectedTime = {
                hour: hours % 12 || 12,
                minute: initialDate.getMinutes(),
                meridiem: hours >= 12 ? 'PM' : 'AM'
            };
        } else {
            // Default to today
            const now = new Date();
            this.selectedDate = new Date(now); // Set today as selected by default
            this.currentMonth = new Date(now);
            const hours = now.getHours();
            this.selectedTime = {
                hour: hours % 12 || 12,
                minute: now.getMinutes(),
                meridiem: hours >= 12 ? 'PM' : 'AM'
            };
        }
        
        console.log('📅 [CalendarWidget] Calling render()...');
        this.render();
        console.log('📅 [CalendarWidget] render() complete, overlay:', this.overlay);
    }

    /**
     * Hide calendar picker
     */
    hide() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.container = null;
        }
    }

    /**
     * Render the calendar widget
     */
    render() {
        console.log('📅 [CalendarWidget] render() started');
        
        // Remove existing if present
        this.hide();
        
        console.log('📅 [CalendarWidget] Creating overlay element...');
        
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'calendar-overlay';
        this.overlay.onclick = (e) => {
            // Stop propagation to prevent drawer from closing
            e.stopPropagation();
            if (e.target === this.overlay) {
                this.hide();
            }
        };
        
        console.log('📅 [CalendarWidget] Creating container element...');
        
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'calendar-container';
        // Stop propagation on the container to prevent drawer close
        this.container.onclick = (e) => {
            e.stopPropagation();
        };
        this.container.innerHTML = this.getHTML();
        
        console.log('📅 [CalendarWidget] Appending to DOM...');
        
        this.overlay.appendChild(this.container);
        document.body.appendChild(this.overlay);
        
        console.log('📅 [CalendarWidget] DOM elements appended, overlay element:', this.overlay);
        console.log('📅 [CalendarWidget] Overlay in document:', document.body.contains(this.overlay));
        
        // Attach event listeners
        this.attachListeners();
        
        console.log('📅 [CalendarWidget] render() complete');
    }

    /**
     * Get HTML for calendar
     */
    getHTML() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        return `
            <div class="calendar-header">
                <div class="calendar-title">Select Date & Time</div>
                <button class="calendar-close" onclick="window.calendarWidget.hide()">×</button>
            </div>
            
            <div class="calendar-body">
                <!-- Month navigation -->
                <div class="calendar-month-nav">
                    <button class="calendar-nav-btn" data-action="prev-month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <div class="calendar-month-label">${this.getMonthName(month)} ${year}</div>
                    <button class="calendar-nav-btn" data-action="next-month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>
                
                <!-- Calendar grid -->
                <div class="calendar-grid">
                    ${this.getCalendarGrid()}
                </div>
            </div>
            
            <div class="calendar-footer">
                <div class="calendar-footer-left">
                    <button class="calendar-btn calendar-btn-icon calendar-btn-today" data-action="today" title="Now">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="calendar-time-inputs">
                    <input type="text" 
                           class="calendar-time-input-single" 
                           id="calendarTime"
                           maxlength="5"
                           value="${String(this.selectedTime.hour).padStart(2, '0')}:${String(this.selectedTime.minute).padStart(2, '0')}"
                           placeholder="HH:MM">
                    <button class="calendar-meridiem-toggle" 
                            data-meridiem="${this.selectedTime.meridiem}"
                            title="Toggle AM/PM">${this.selectedTime.meridiem}</button>
                </div>
                <button class="calendar-btn calendar-btn-select" data-action="select">Select</button>
            </div>
        `;
    }

    /**
     * Get calendar grid HTML
     */
    getCalendarGrid() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay(); // 0 = Sunday
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let html = '';
        
        // Day headers
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Empty cells before first day
        for (let i = 0; i < startDay; i++) {
            html += `<div class="calendar-day calendar-day-empty"></div>`;
        }
        
        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            date.setHours(0, 0, 0, 0);
            
            const isToday = date.getTime() === today.getTime();
            const isSelected = this.selectedDate && 
                              date.getTime() === new Date(this.selectedDate.getFullYear(), 
                                                          this.selectedDate.getMonth(), 
                                                          this.selectedDate.getDate()).getTime();
            const isPast = date < today;
            
            let classes = 'calendar-day';
            if (isToday) classes += ' calendar-day-today';
            if (isSelected) classes += ' calendar-day-selected';
            if (isPast) classes += ' calendar-day-past';
            
            html += `<div class="${classes}" data-date="${year}-${month + 1}-${day}">${day}</div>`;
        }
        
        return html;
    }

    /**
     * Attach event listeners
     */
    attachListeners() {
        // Month navigation
        this.container.querySelectorAll('[data-action="prev-month"]').forEach(btn => {
            btn.onclick = () => this.changeMonth(-1);
        });
        
        this.container.querySelectorAll('[data-action="next-month"]').forEach(btn => {
            btn.onclick = () => this.changeMonth(1);
        });
        
        // Day selection - don't allow past dates
        this.container.querySelectorAll('.calendar-day:not(.calendar-day-empty):not(.calendar-day-past)').forEach(day => {
            day.onclick = () => this.selectDay(day.dataset.date);
        });
        
        // Time inputs
        const timeInput = document.getElementById('calendarTime');
        
        if (timeInput) {
            timeInput.oninput = () => {
                // Allow user to type freely without auto-formatting
                const value = timeInput.value;
                
                // Only parse if it looks like a valid time format
                const match = value.match(/^(\d{1,2}):?(\d{0,2})$/);
                
                if (match) {
                    let hour = parseInt(match[1]) || 0;
                    let minute = match[2] ? parseInt(match[2]) : 0;
                    
                    // Clamp values
                    if (hour > 12) hour = 12;
                    if (hour < 1) hour = 1;
                    if (minute > 59) minute = 59;
                    if (minute < 0) minute = 0;
                    
                    this.selectedTime.hour = hour;
                    this.selectedTime.minute = minute;
                }
                
                // Don't auto-format while typing
            };
            
            timeInput.onblur = () => {
                // Ensure proper format on blur
                timeInput.value = `${String(this.selectedTime.hour).padStart(2, '0')}:${String(this.selectedTime.minute).padStart(2, '0')}`;
            };
        }
        
        // Meridiem toggle button
        const meridiemToggle = this.container.querySelector('.calendar-meridiem-toggle');
        if (meridiemToggle) {
            meridiemToggle.onclick = () => {
                const newMeridiem = this.selectedTime.meridiem === 'AM' ? 'PM' : 'AM';
                this.selectedTime.meridiem = newMeridiem;
                meridiemToggle.textContent = newMeridiem;
                meridiemToggle.dataset.meridiem = newMeridiem;
                // Revalidate when meridiem changes
                this.updateSelectButtonState();
            };
        }
        
        // Update time input validation to also check select button
        if (timeInput) {
            const originalOnInput = timeInput.oninput;
            timeInput.oninput = () => {
                originalOnInput();
                this.updateSelectButtonState();
            };
        }
        
        // Footer buttons
        this.container.querySelector('[data-action="today"]').onclick = () => {
            const now = new Date();
            // Add 1 minute to avoid "too fast" blocking
            now.setMinutes(now.getMinutes() + 1);
            this.currentMonth = new Date(now);
            this.selectedDate = now;
            const hours = now.getHours();
            this.selectedTime = {
                hour: hours % 12 || 12,
                minute: now.getMinutes(),
                meridiem: hours >= 12 ? 'PM' : 'AM'
            };
            this.render();
        };
        
        this.container.querySelector('[data-action="select"]').onclick = () => {
            console.log('📅 [CalendarWidget] Select button clicked');
            console.log('📅 [CalendarWidget] selectedDate:', this.selectedDate);
            console.log('📅 [CalendarWidget] onSelect callback:', typeof this.onSelect);
            console.log('📅 [CalendarWidget] isPast:', this.isSelectedTimePast());
            
            if (this.selectedDate && this.onSelect && !this.isSelectedTimePast()) {
                const result = new Date(this.selectedDate);
                // Convert 12-hour to 24-hour
                let hour24 = this.selectedTime.hour;
                if (this.selectedTime.meridiem === 'PM' && hour24 !== 12) {
                    hour24 += 12;
                } else if (this.selectedTime.meridiem === 'AM' && hour24 === 12) {
                    hour24 = 0;
                }
                result.setHours(hour24);
                result.setMinutes(this.selectedTime.minute);
                result.setSeconds(0);
                result.setMilliseconds(0);
                
                console.log('📅 [CalendarWidget] Calling onSelect with:', result);
                console.log('📅 [CalendarWidget] Result ISO:', result.toISOString());
                
                this.onSelect(result);
                
                console.log('✅ [CalendarWidget] onSelect callback completed');
            } else {
                console.warn('⚠️ [CalendarWidget] Cannot select:', {
                    hasDate: !!this.selectedDate,
                    hasCallback: !!this.onSelect,
                    isPast: this.isSelectedTimePast()
                });
            }
            this.hide();
        };
        
        // Initial validation check
        this.updateSelectButtonState();
    }
    
    /**
     * Check if selected date/time is in the past
     */
    isSelectedTimePast() {
        if (!this.selectedDate) return false;
        
        const result = new Date(this.selectedDate);
        // Convert 12-hour to 24-hour
        let hour24 = this.selectedTime.hour;
        if (this.selectedTime.meridiem === 'PM' && hour24 !== 12) {
            hour24 += 12;
        } else if (this.selectedTime.meridiem === 'AM' && hour24 === 12) {
            hour24 = 0;
        }
        result.setHours(hour24);
        result.setMinutes(this.selectedTime.minute);
        result.setSeconds(0);
        result.setMilliseconds(0);
        
        const now = new Date();
        return result <= now;
    }
    
    /**
     * Update the Select button disabled state based on validation
     */
    updateSelectButtonState() {
        const selectBtn = this.container.querySelector('[data-action="select"]');
        if (!selectBtn) return;
        
        const isPast = this.isSelectedTimePast();
        
        if (isPast) {
            selectBtn.classList.add('calendar-btn-disabled');
            selectBtn.disabled = true;
        } else {
            selectBtn.classList.remove('calendar-btn-disabled');
            selectBtn.disabled = false;
        }
    }

    /**
     * Change month
     */
    changeMonth(delta) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + delta);
        this.render();
    }

    /**
     * Select a day
     */
    selectDay(dateString) {
        console.log('📅 [CalendarWidget] selectDay called with:', dateString);
        const [year, month, day] = dateString.split('-').map(n => parseInt(n));
        this.selectedDate = new Date(year, month - 1, day);
        console.log('📅 [CalendarWidget] selectedDate set to:', this.selectedDate);
        console.log('📅 [CalendarWidget] Calling render to update UI...');
        this.render();
        console.log('✅ [CalendarWidget] Day selected and rendered');
    }

    /**
     * Get month name
     */
    getMonthName(month) {
        const names = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return names[month];
    }
}

// Global instance
console.log('📅 [calendar.js] Creating CalendarWidget instance...');
window.calendarWidget = new CalendarWidget();
console.log('✅ [calendar.js] CalendarWidget instance created:', window.calendarWidget);
console.log('✅ [calendar.js] CalendarWidget.show method:', typeof window.calendarWidget.show);
