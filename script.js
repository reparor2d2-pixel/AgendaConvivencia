// =============== GESTIÓN ESCOLAR 2.6 ===============
// Versión completa con NOTIFICACIONES DEL SISTEMA que aparecen sobre cualquier ventana
// MODIFICADO: Carta Gantt con desplazamiento horizontal

// Variables globales
let currentDate = new Date();
let activities = [];
let currentFilter = 'all';
let currentView = 'dashboard';
let editingId = null;
let selectedIds = new Set();
let alarmTimers = new Map();
let defaultAlarmMinutes = 15;
let globalAlarmsEnabled = true;
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SYNC_FILENAME = 'convivencia_escolar_sync.json';

// Mapeo de iconos por tipo de actividad
const typeIcons = {
    'actividad': '👥',
    'reunion': '🤝',
    'efemeride': '⭐',
    'recordatorio': '🔔'
};

// Mapeo de nombres completos por tipo
const typeNames = {
    'actividad': 'Actividad',
    'reunion': 'Reunión',
    'efemeride': 'Efeméride',
    'recordatorio': 'Recordatorio'
};

// Mapeo de iconos de prioridad
const priorityIcons = {
    'high': '🔴',
    'medium': '🟡',
    'low': '🟢'
};

// Mapeo de nombres de prioridad
const priorityNames = {
    'high': 'Alta',
    'medium': 'Media',
    'low': 'Baja'
};

// Mapeo de textos para alarmas
const alarmTexts = {
    '5': '5 minutos antes',
    '15': '15 minutos antes',
    '30': '30 minutos antes',
    '60': '1 hora antes',
    '1440': '1 día antes',
    '0': 'En el momento'
};

// Función para normalizar fechas (CORREGIDA - Sin problemas de zona horaria)
function normalizeDate(dateString) {
    if (!dateString) return new Date();
    
    // Si ya es un objeto Date, devolverlo
    if (dateString instanceof Date) return dateString;
    
    // Manejar formato YYYY-MM-DD (el formato de input date)
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        
        // Crear fecha LOCAL, no UTC
        return new Date(year, month, day, 0, 0, 0, 0);
    }
    
    return new Date(dateString);
}

// Obtener día directamente del string de fecha
function getDayFromDateString(dateString) {
    if (!dateString) return 1;
    
    if (typeof dateString === 'string' && dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return parseInt(parts[2]);
        }
    }
    
    const date = normalizeDate(dateString);
    return date.getDate();
}

// Crear fecha desde string
function createDateFromString(dateString) {
    if (!dateString) return new Date();
    
    if (typeof dateString === 'string' && dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            return new Date(year, month, day, 0, 0, 0, 0);
        }
    }
    
    return normalizeDate(dateString);
}

// Función auxiliar para comparar fechas
function compareDates(date1, date2) {
    const d1 = createDateFromString(date1);
    const d2 = createDateFromString(date2);
    
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    
    return d1.getTime() === d2.getTime();
}

// Utilidades
function formatDateFriendly(dateStr) {
    if(!dateStr) return '';
    
    let date;
    
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            date = new Date(year, month, day);
        } else {
            date = new Date(dateStr);
        }
    } else {
        date = new Date(dateStr);
    }
    
    return date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// =============== FUNCIONES PRINCIPALES ===============

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadData();
    updateCurrentDate();
    checkForDuplicates();
    
    initGanttTooltip();
    initAlarmSystem();
    loadAlarmSettings();
    startAlarmChecker();
    
    // Solicitar permisos para notificaciones del sistema INMEDIATAMENTE
    requestNotificationPermission();
    
    setTimeout(setupDashboardClickEvents, 500);
});

// =============== SISTEMA DE NOTIFICACIONES DEL SISTEMA ===============

// Solicitar permiso para notificaciones del sistema (NUEVA FUNCIÓN MEJORADA)
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("Este navegador no soporta notificaciones del sistema");
        return;
    }
    
    // Verificar si ya tenemos permiso
    if (Notification.permission === "granted") {
        console.log("Notificaciones del sistema ya permitidas");
        return;
    }
    
    // Si está denegado, mostrar instrucciones
    if (Notification.permission === "denied") {
        console.log("Permiso de notificaciones denegado por el usuario");
        showNotification("Las notificaciones del sistema están bloqueadas. Por favor, habilítalas en la configuración de tu navegador para recibir alarmas.", "error");
        return;
    }
    
    // Si está en default, solicitar permiso
    if (Notification.permission === "default") {
        // Usar un pequeño retraso para que no interrumpa la carga inicial
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("Permiso de notificaciones concedido");
                    showNotification("✅ Notificaciones del sistema activadas. Recibirás alarmas incluso con el navegador minimizado.", "success");
                } else if (permission === "denied") {
                    console.log("Permiso de notificaciones denegado");
                    showNotification("❌ Notificaciones del sistema bloqueadas. No recibirás alarmas con el navegador minimizado.", "error");
                }
            });
        }, 2000); // Esperar 2 segundos después de cargar la página
    }
}

// Mostrar notificación del sistema (aparece sobre cualquier ventana)
function showSystemNotification(activity) {
    if (!("Notification" in window)) {
        console.log("No se pueden mostrar notificaciones del sistema");
        return false;
    }
    
    if (Notification.permission !== "granted") {
        console.log("Permiso de notificaciones no concedido");
        return false;
    }
    
    try {
        // Crear notificación del sistema con opciones avanzadas
        const options = {
            body: `La actividad "${activity.title}" comenzará ${getAlarmText(activity.alarmMinutes)}.`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3062/3062634.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/3062/3062634.png',
            tag: `convivencia-alarm-${activity.id}`,
            requireInteraction: true, // IMPORTANTE: Mantiene la notificación visible hasta que el usuario interactúe
            silent: false, // Reproduce sonido
            vibrate: [200, 100, 200], // Patrón de vibración para móviles
            data: {
                url: window.location.href,
                activityId: activity.id,
                timestamp: new Date().toISOString()
            },
            actions: [
                {
                    action: 'open',
                    title: 'Abrir aplicación'
                },
                {
                    action: 'snooze',
                    title: 'Posponer 5 min'
                }
            ]
        };
        
        const notification = new Notification(`⏰ Alarma: ${activity.title}`, options);
        
        // Manejar clics en la notificación
        notification.onclick = function(event) {
            event.preventDefault();
            
            // Enfocar la ventana del navegador
            window.focus();
            
            // Abrir la actividad en la aplicación
            if (this.data && this.data.activityId) {
                openModal(this.data.activityId);
            }
            
            // Cerrar la notificación
            this.close();
        };
        
        // Manejar acciones de la notificación
        notification.addEventListener('click', function(event) {
            if (event.action === 'open') {
                window.focus();
                if (activity.id) {
                    openModal(activity.id);
                }
            } else if (event.action === 'snooze') {
                // Posponer la alarma 5 minutos
                activity.alarmMinutes = 5;
                activity.lastAlarmTriggeredDate = '';
                saveData();
                showNotification(`Alarma pospuesta 5 minutos para "${activity.title}"`, 'success');
            }
            notification.close();
        });
        
        // Cerrar automáticamente después de 30 segundos (solo si no es requireInteraction)
        setTimeout(() => {
            notification.close();
        }, 30000);
        
        return true;
    } catch (error) {
        console.error("Error mostrando notificación del sistema:", error);
        return false;
    }
}

// Mostrar notificación persistente (para cuando la ventana está minimizada)
function showPersistentNotification(activity) {
    // Primero intentar con notificaciones del sistema
    const systemNotificationShown = showSystemNotification(activity);
    
    // Si las notificaciones del sistema fallan, mostrar notificación en la aplicación
    if (!systemNotificationShown) {
        showInAppAlarmNotification(activity);
    }
    
    // Siempre reproducir sonido
    playAlarmSound();
    
    // Mostrar alerta visual si la ventana está activa
    if (!document.hidden) {
        showAlarmAlert(activity);
    }
}

// Inicializar sistema de alarmas
function initAlarmSystem() {
    // Crear contenedor para notificaciones si no existe
    if (!document.getElementById('alarmNotificationsContainer')) {
        const container = document.createElement('div');
        container.id = 'alarmNotificationsContainer';
        document.body.appendChild(container);
    }
    
    // Configurar opciones de alarma por defecto
    updateAlarmOptionsUI();
}

// Cargar configuración de alarmas
function loadAlarmSettings() {
    const savedSettings = localStorage.getItem('alarmSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            defaultAlarmMinutes = settings.defaultAlarmMinutes || 15;
            globalAlarmsEnabled = settings.globalAlarmsEnabled !== false;
            
            updateAlarmOptionsUI();
            updateGlobalAlarmToggle();
        } catch (e) {
            console.error('Error cargando configuración de alarmas:', e);
        }
    }
}

// Guardar configuración de alarmas
function saveAlarmSettings() {
    const settings = {
        defaultAlarmMinutes: defaultAlarmMinutes,
        globalAlarmsEnabled: globalAlarmsEnabled,
        lastSave: new Date().toISOString()
    };
    
    localStorage.setItem('alarmSettings', JSON.stringify(settings));
}

// Actualizar UI de opciones de alarma
function updateAlarmOptionsUI() {
    const options = document.querySelectorAll('.alarm-option');
    options.forEach(option => {
        const minutes = parseInt(option.dataset.minutes);
        if (minutes === defaultAlarmMinutes) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    updateAlarmCount();
}

// Actualizar botón global de alarmas
function updateGlobalAlarmToggle() {
    const toggleBtn = document.getElementById('toggleAllAlarms');
    if (toggleBtn) {
        if (globalAlarmsEnabled) {
            toggleBtn.innerHTML = '<i class="fas fa-bell"></i> <span class="btn-text">Desactivar Todas las Alarmas</span>';
            toggleBtn.classList.add('active');
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-bell-slash"></i> <span class="btn-text">Activar Todas las Alarmas</span>';
            toggleBtn.classList.remove('active');
        }
    }
}

// Actualizar contador de alarmas activas
function updateAlarmCount() {
    const alarmCountElement = document.getElementById('alarmCount');
    if (alarmCountElement) {
        const activeAlarms = activities.filter(a => a.alarmMinutes > 0).length;
        alarmCountElement.textContent = activeAlarms;
        
        const alarmStatus = document.getElementById('alarmStatus');
        if (alarmStatus) {
            alarmStatus.style.color = activeAlarms > 0 ? '#f59e0b' : '';
            alarmStatus.style.fontWeight = activeAlarms > 0 ? 'bold' : '';
        }
    }
}

// Iniciar verificador periódico de alarmas
function startAlarmChecker() {
    // Verificar alarmas cada 30 segundos
    setInterval(checkAlarms, 30000);
    
    // Verificar inmediatamente al cargar
    setTimeout(checkAlarms, 1000);
    
    // Verificar también cuando la página se vuelve visible
    document.addEventListener('visibilitychange', checkAlarms);
    
    // Verificar cuando la ventana obtiene foco
    window.addEventListener('focus', checkAlarms);
}

// Verificar y disparar alarmas
function checkAlarms() {
    if (!globalAlarmsEnabled) return;
    
    const now = new Date();
    const currentDateStr = now.toDateString();
    
    activities.forEach(activity => {
        if (activity.alarmMinutes > 0 && activity.lastAlarmTriggeredDate !== currentDateStr) {
            const eventDate = createDateFromString(activity.date);
            
            if (activity.time) {
                const [hours, minutes] = activity.time.split(':');
                eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            } else {
                eventDate.setHours(0, 0, 0, 0);
            }
            
            const alarmTime = new Date(eventDate.getTime() - (activity.alarmMinutes * 60000));
            const timeDiff = alarmTime.getTime() - now.getTime();
            
            // Disparar si estamos dentro de un margen de 30 segundos
            if (timeDiff >= 0 && timeDiff < 30000) {
                triggerAlarm(activity);
            }
        }
    });
}

// Disparar una alarma (USANDO NOTIFICACIONES DEL SISTEMA)
function triggerAlarm(activity) {
    const today = new Date().toDateString();
    const lastTriggered = activity.lastAlarmTriggeredDate;
    
    if (lastTriggered === today) {
        return;
    }
    
    // Marcar como disparada
    activity.alarmTriggered = true;
    activity.lastAlarmTriggeredDate = today;
    saveData();
    
    // MOSTRAR NOTIFICACIÓN DEL SISTEMA (aparece sobre cualquier ventana)
    showPersistentNotification(activity);
    
    // Actualizar la vista
    updateView();
}

// Función para reproducir sonido de alarma
function playAlarmSound() {
    try {
        const audio = new Audio();
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
        audio.volume = 0.5;
        
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Reproducción automática prevenida:", error);
                playFallbackBeep();
            });
        }
    } catch (e) {
        console.log("Error reproduciendo sonido:", e);
        playFallbackBeep();
    }
}

// Función de respaldo para beep
function playFallbackBeep() {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.8);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.8);
    } catch (e) {
        console.log("No se pudo reproducir sonido de alarma:", e);
    }
}

// Mostrar alerta visual de alarma (solo si la ventana está activa)
function showAlarmAlert(activity) {
    // Solo mostrar si la ventana está visible
    if (document.hidden) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        padding: 20px;
        border-radius: 12px;
        z-index: 99999;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        text-align: center;
        min-width: 300px;
        animation: alarmPulse 1s infinite;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes alarmPulse {
            0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
            70% { transform: translate(-50%, -50%) scale(1.05); box-shadow: 0 0 0 20px rgba(245, 158, 11, 0); }
            100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
    `;
    document.head.appendChild(style);
    
    alertDiv.innerHTML = `
        <div style="font-size: 1.5rem; margin-bottom: 10px;">
            <i class="fas fa-bell"></i>
        </div>
        <div style="font-weight: bold; margin-bottom: 5px;">${activity.title}</div>
        <div style="font-size: 0.9rem; margin-bottom: 10px;">
            Comienza ${getAlarmText(activity.alarmMinutes)}
        </div>
        <div style="font-size: 0.8rem; opacity: 0.9;">
            ${activity.time ? `Hora: ${activity.time}` : 'Día completo'}
        </div>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 15px;
            background: white;
            color: #d97706;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        ">
            OK
        </button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 10000);
}

// Mostrar notificación de alarma en la aplicación (solo como respaldo)
function showInAppAlarmNotification(activity) {
    const container = document.getElementById('alarmNotificationsContainer');
    if (!container) return;
    
    const notificationId = `alarm-notif-${Date.now()}`;
    const alarmText = getAlarmText(activity.alarmMinutes);
    const eventTime = activity.time ? `a las ${activity.time}` : 'hoy';
    
    const notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = 'notification-alarm';
    notification.innerHTML = `
        <div class="notification-alarm-icon">
            <i class="fas fa-bell"></i>
        </div>
        <div class="notification-alarm-content">
            <div class="notification-alarm-title">⏰ ${activity.title}</div>
            <div class="notification-alarm-message">
                La actividad "${activity.title}" comenzará ${alarmText} (${eventTime}).
                ${activity.description ? `<br><small>${activity.description}</small>` : ''}
            </div>
            <div class="notification-alarm-time">${new Date().toLocaleTimeString()}</div>
        </div>
        <button class="notification-alarm-close" onclick="document.getElementById('${notificationId}').remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        const notif = document.getElementById(notificationId);
        if (notif) notif.remove();
    }, 30000);
}

// Obtener texto descriptivo de la alarma
function getAlarmText(minutes) {
    if (minutes === 0) return 'ahora';
    if (minutes < 60) return `en ${minutes} minutos`;
    if (minutes < 1440) return `en ${Math.floor(minutes / 60)} horas`;
    return 'mañana';
}

// =============== RESTA DEL CÓDIGO (IGUAL QUE ANTES) ===============

// Configurar clics en dashboard
function setupDashboardClickEvents() {
    const pendingElement = document.getElementById('dashPending');
    if (pendingElement) {
        pendingElement.style.cursor = 'pointer';
        pendingElement.title = 'Click para ver en calendario';
        pendingElement.addEventListener('click', () => {
            document.querySelector('[data-view="calendar"]').click();
            
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            document.querySelector('.filter-chip.active').classList.remove('active');
            document.querySelector('.filter-chip[data-filter="all"]').classList.add('active');
            currentFilter = 'all';
            
            setTimeout(() => {
                highlightPendingDays(currentMonth, currentYear, today);
                showNotification('Mostrando actividades pendientes del mes actual', 'info');
            }, 100);
        });
    }
}

// Resaltar días pendientes en calendario
function highlightPendingDays(month, year, today) {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    
    const dayElements = grid.querySelectorAll('.calendar-day:not(.empty)');
    
    dayElements.forEach(dayEl => {
        const dayNumber = dayEl.querySelector('.day-number').textContent;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
        
        const dayDate = createDateFromString(dateStr);
        dayDate.setHours(0, 0, 0, 0);
        
        const isFuture = dayDate >= today;
        const hasActivities = activities.some(a => {
            const activityDate = createDateFromString(a.date);
            activityDate.setHours(0, 0, 0, 0);
            return activityDate.getTime() === dayDate.getTime();
        });
        
        if (isFuture && hasActivities) {
            dayEl.style.boxShadow = '0 0 0 2px #10b981';
            dayEl.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            
            const dayNumberEl = dayEl.querySelector('.day-number');
            if (dayNumberEl) {
                dayNumberEl.style.backgroundColor = '#10b981';
                dayNumberEl.style.color = 'white';
                dayNumberEl.style.borderRadius = '50%';
                dayNumberEl.style.width = '24px';
                dayNumberEl.style.height = '24px';
                dayNumberEl.style.display = 'flex';
                dayNumberEl.style.alignItems = 'center';
                dayNumberEl.style.justifyContent = 'center';
                dayNumberEl.style.fontWeight = 'bold';
            }
        }
    });
    
    const pendingDays = Array.from(dayElements).filter(dayEl => {
        const dayNumber = dayEl.querySelector('.day-number').textContent;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
        const dayDate = createDateFromString(dateStr);
        dayDate.setHours(0, 0, 0, 0);
        
        const isFuture = dayDate >= today;
        const hasActivities = activities.some(a => {
            const activityDate = createDateFromString(a.date);
            activityDate.setHours(0, 0, 0, 0);
            return activityDate.getTime() === dayDate.getTime();
        });
        
        return isFuture && hasActivities;
    }).length;
    
    const calendarHeader = document.querySelector('.calendar-header');
    if (calendarHeader && pendingDays > 0) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
            grid-column: 1 / -1;
            text-align: center;
            padding: 10px;
            background: #10b981;
            color: white;
            margin-top: 5px;
            border-radius: 6px;
            font-size: 0.9rem;
        `;
        infoDiv.innerHTML = `<i class="fas fa-calendar-check"></i> ${pendingDays} días con actividades pendientes este mes`;
        calendarHeader.parentNode.insertBefore(infoDiv, calendarHeader.nextSibling);
    }
}

// Inicializar tooltip para Gantt
function initGanttTooltip() {
    if (!document.getElementById('ganttTooltip')) {
        const tooltip = document.createElement('div');
        tooltip.id = 'ganttTooltip';
        tooltip.className = 'gantt-tooltip';
        document.body.appendChild(tooltip);
    }
}

// Mostrar tooltip para actividad en Gantt
function showGanttTooltip(event, activity) {
    const tooltip = document.getElementById('ganttTooltip');
    if (!tooltip || !activity) return;
    
    const date = createDateFromString(activity.date);
    const formattedDate = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const alarmInfo = activity.alarmMinutes > 0 ? 
        `<div class="gantt-tooltip-row">
            <span class="gantt-tooltip-label">Alarma:</span>
            <span class="gantt-tooltip-value" style="color: #f59e0b;">
                <i class="fas fa-bell"></i> ${getAlarmText(activity.alarmMinutes)}
            </span>
        </div>` : '';
    
    tooltip.innerHTML = `
        <div class="gantt-tooltip-header">
            <div class="gantt-tooltip-icon" style="background: ${activity.color}">
                ${typeIcons[activity.type] || '📌'}
            </div>
            <div class="gantt-tooltip-title">${activity.title}</div>
        </div>
        <div class="gantt-tooltip-content">
            <div class="gantt-tooltip-row">
                <span class="gantt-tooltip-label">Tipo:</span>
                <span class="gantt-tooltip-value">${typeNames[activity.type] || activity.type}</span>
            </div>
            <div class="gantt-tooltip-row">
                <span class="gantt-tooltip-label">Fecha:</span>
                <span class="gantt-tooltip-value">${formattedDate}</span>
            </div>
            ${activity.time ? `
            <div class="gantt-tooltip-row">
                <span class="gantt-tooltip-label">Hora:</span>
                <span class="gantt-tooltip-value">${activity.time}</span>
            </div>
            ` : ''}
            <div class="gantt-tooltip-row">
                <span class="gantt-tooltip-label">Prioridad:</span>
                <span class="gantt-tooltip-value">${priorityIcons[activity.priority]} ${priorityNames[activity.priority]}</span>
            </div>
            ${alarmInfo}
            ${activity.description ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
                <div class="gantt-tooltip-label" style="margin-bottom: 4px;">Descripción:</div>
                <div style="font-size: 0.8rem; color: var(--text-light); line-height: 1.3;">${activity.description}</div>
            </div>
            ` : ''}
        </div>
    `;
    
    const x = event.clientX + 10;
    const y = event.clientY + 10;
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.classList.add('show');
    
    setTimeout(() => {
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tooltip.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            tooltip.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    }, 0);
}

// Ocultar tooltip
function hideGanttTooltip() {
    const tooltip = document.getElementById('ganttTooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
    }
}

// Cargar datos
function loadData() {
    const saved = localStorage.getItem('schoolData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            activities = data.activities || [];
            
            activities.forEach(activity => {
                if (activity.alarmMinutes === undefined) {
                    activity.alarmMinutes = 0;
                }
                if (activity.alarmTriggered === undefined) {
                    activity.alarmTriggered = false;
                }
                if (activity.lastAlarmTriggeredDate === undefined) {
                    activity.lastAlarmTriggeredDate = '';
                }
            });
            
            updateView();
            renderDashboard();
            updateLastSave();
            checkForDuplicates();
            updateAlarmCount();
        } catch (e) {
            console.error('Error cargando datos:', e);
            showNotification('Error cargando datos', 'error');
            activities = [];
        }
    } else {
        activities = [
            {
                id: '1',
                title: 'Jornada de Convivencia Escolar',
                type: 'actividad',
                date: new Date().toISOString().split('T')[0],
                priority: 'high',
                color: '#4CAF50',
                description: 'Actividad de integración para todos los cursos',
                alarmMinutes: 5,
                alarmTriggered: false,
                lastAlarmTriggeredDate: ''
            },
            {
                id: '2',
                title: 'Consejo de Profesores',
                type: 'reunion',
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                priority: 'medium',
                color: '#2196F3',
                description: 'Reunión mensual del consejo',
                alarmMinutes: 15,
                alarmTriggered: false,
                lastAlarmTriggeredDate: ''
            }
        ];
        saveData();
        updateView();
        renderDashboard();
        checkForDuplicates();
        updateAlarmCount();
    }
}

// Guardar datos
function saveData() {
    try {
        const dataToSave = {
            activities: activities,
            lastSave: new Date().toISOString(),
            version: '2.6'
        };
        
        localStorage.setItem('schoolData', JSON.stringify(dataToSave));
        updateLastSave();
        checkForDuplicates();
        updateAlarmCount();
        return true;
    } catch (e) {
        console.error('Error guardando datos:', e);
        showNotification('Error guardando datos', 'error');
        return false;
    }
}

// Actualizar última sincronización
function updateLastSave() {
    const lastSave = document.getElementById('lastSave');
    if (lastSave) {
        const now = new Date();
        lastSave.textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }
}

// =============== FUNCIÓN: DETECTAR Y ELIMINAR DUPLICADOS ===============

function findDuplicates() {
    const seen = new Map();
    const duplicates = [];
    
    activities.forEach(activity => {
        const key = `${activity.title.toLowerCase()}_${activity.date}_${activity.type}`;
        
        if (seen.has(key)) {
            duplicates.push({
                duplicate: activity,
                original: seen.get(key),
                key: key
            });
        } else {
            seen.set(key, activity);
        }
    });
    
    return duplicates;
}

function countDuplicates() {
    const duplicates = findDuplicates();
    return duplicates.length;
}

function updateDuplicateCounter() {
    const count = countDuplicates();
    const duplicateNumber = document.getElementById('duplicateNumber');
    const duplicateCount = document.getElementById('duplicateCount');
    const cleanBtn = document.getElementById('cleanDuplicates');
    const cleanBtnList = document.getElementById('cleanDuplicatesList');
    
    if (duplicateNumber) {
        duplicateNumber.textContent = count;
    }
    
    if (duplicateCount) {
        if (count > 0) {
            duplicateCount.style.color = '#f59e0b';
            duplicateCount.style.fontWeight = 'bold';
        } else {
            duplicateCount.style.color = '';
            duplicateCount.style.fontWeight = '';
        }
    }
    
    if (cleanBtn) {
        cleanBtn.disabled = count === 0;
    }
    
    if (cleanBtnList) {
        cleanBtnList.disabled = count === 0;
    }
    
    return count;
}

function checkForDuplicates() {
    const count = updateDuplicateCounter();
    
    if (count > 0) {
        console.log(`Se encontraron ${count} actividades duplicadas`);
        
        if (count > 3) {
            showNotification(`⚠️ Se encontraron ${count} actividades duplicadas`, 'error');
        }
    }
    
    return count;
}

function removeDuplicates() {
    const duplicatesCount = countDuplicates();
    
    if (duplicatesCount === 0) {
        showNotification('No hay actividades duplicadas para eliminar', 'info');
        return 0;
    }
    
    if (!confirm(`¿Eliminar ${duplicatesCount} actividades duplicadas?\n\nSe conservará la primera aparición de cada actividad.`)) {
        return 0;
    }
    
    const seen = new Map();
    const originalCount = activities.length;
    
    activities = activities.filter(activity => {
        const key = `${activity.title.toLowerCase()}_${activity.date}_${activity.type}`;
        
        if (seen.has(key)) {
            return false;
        } else {
            seen.set(key, activity);
            return true;
        }
    });
    
    const removedCount = originalCount - activities.length;
    
    if (removedCount > 0) {
        saveData();
        updateView();
        checkForDuplicates();
        showNotification(`✅ Se eliminaron ${removedCount} actividades duplicadas`, 'success');
        
        setTimeout(() => {
            alert(`Limpieza completada:\n\n• Actividades antes: ${originalCount}\n• Actividades después: ${activities.length}\n• Duplicados eliminados: ${removedCount}`);
        }, 500);
    } else {
        showNotification('No se encontraron duplicados para eliminar', 'info');
    }
    
    return removedCount;
}

// =============== FUNCIÓN PARA CARTA GANTT CON SCROLL HORIZONTAL ===============
function renderGantt() {
    const container = document.getElementById('ganttContent');
    const headerDays = document.querySelector('.timeline-days');
    
    if(!container || !headerDays) return;
    
    container.innerHTML = '';
    headerDays.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    
    for(let i = 1; i <= daysInMonth; i++) {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'gantt-day-header';
        dayHeader.textContent = i;
        
        if (isCurrentMonth && i === today.getDate()) {
            dayHeader.classList.add('current-day');
        }
        
        headerDays.appendChild(dayHeader);
    }
    
    const monthActs = activities.filter(a => {
        const date = createDateFromString(a.date);
        return date.getMonth() === month && 
               date.getFullYear() === year && 
               (currentFilter === 'all' || a.type === currentFilter);
    });
    
    monthActs.forEach(act => {
        const day = getDayFromDateString(act.date);
        
        if (day < 1 || day > daysInMonth) {
            console.warn(`Día fuera de rango: ${day} para actividad "${act.title}"`);
            return;
        }
        
        let duration = 1;
        
        if (act.endDate) {
            const endDate = createDateFromString(act.endDate);
            const startDate = createDateFromString(act.date);
            
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);
            duration = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        }
        
        const colWidth = 40;
        const left = (day - 1) * colWidth;
        const width = duration * colWidth - 2;
        
        const icon = typeIcons[act.type] || '📌';
        const alarmClass = act.alarmMinutes > 0 ? 'alarm-active' : '';
        
        const row = document.createElement('div');
        row.className = 'gantt-row';
        row.innerHTML = `
            <div class="gantt-task-name">
                <div style="width:10px; height:10px; border-radius:50%; background:${act.color}"></div>
                ${act.title}
                ${act.alarmMinutes > 0 ? '<span class="alarm-indicator" style="margin-left: 5px;" title="Tiene alarma configurada"><i class="fas fa-bell"></i></span>' : ''}
            </div>
            <div class="gantt-task-bar-area" style="position: relative;">
                <div class="gantt-bar ${alarmClass}" style="left: ${left}px; width: ${width}px; background: ${act.color}" data-id="${act.id}">
                    <span class="gantt-bar-icon">${icon}</span>
                </div>
            </div>
        `;
        
        const ganttBar = row.querySelector('.gantt-bar');
        ganttBar.addEventListener('mouseenter', (e) => {
            showGanttTooltip(e, act);
        });
        
        ganttBar.addEventListener('mousemove', (e) => {
            const tooltip = document.getElementById('ganttTooltip');
            if (tooltip && tooltip.classList.contains('show')) {
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY + 10}px`;
            }
        });
        
        ganttBar.addEventListener('mouseleave', () => {
            hideGanttTooltip();
        });
        
        ganttBar.addEventListener('click', () => {
            openModal(act.id);
        });
        
        container.appendChild(row);
    });
    
    if (isCurrentMonth && today.getDate() <= daysInMonth) {
        const taskBarAreas = document.querySelectorAll('.gantt-task-bar-area');
        taskBarAreas.forEach(area => {
            const marker = document.createElement('div');
            marker.className = 'gantt-current-day-marker';
            marker.style.left = `${(today.getDate() - 1) * 40}px`;
            area.appendChild(marker);
        });
    }
    
    // Auto-scroll al día actual si estamos en el mes actual
    if (isCurrentMonth) {
        setTimeout(() => {
            const scrollContainer = document.getElementById('ganttScrollContainer');
            if (scrollContainer) {
                const dayWidth = 40;
                const todayPosition = (today.getDate() - 5) * dayWidth; // Dejar 5 días de margen
                scrollContainer.scrollLeft = Math.max(0, todayPosition);
            }
        }, 100);
    }
}

// =============== NUEVAS FUNCIONES PARA SINCRONIZACIÓN ===============

function exportSyncFile() {
    const dataToSave = {
        activities: activities,
        lastSave: new Date().toISOString(),
        version: '2.6',
        exportDate: new Date().toISOString(),
        totalActivities: activities.length,
        syncType: 'convivencia_escolar'
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToSave, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", SYNC_FILENAME);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    
    showNotification(`Archivo de sincronización exportado: ${SYNC_FILENAME}`, 'success');
    return true;
}

function importSyncFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const newActivities = data.activities || [];
            
            if (newActivities.length === 0) {
                showNotification('El archivo no contiene actividades', 'error');
                return;
            }
            
            if (!data.syncType || data.syncType !== 'convivencia_escolar') {
                if (!confirm('Este archivo no parece ser un archivo de sincronización de Convivencia Escolar. ¿Deseas intentar importarlo de todos modos?')) {
                    return;
                }
            }
            
            showSyncImportDialog(newActivities, data);
        } catch (error) {
            console.error('Error importando:', error);
            showNotification('Error al importar el archivo', 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

function showSyncImportDialog(newActivities, importedData) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 500px;">
            <div class="modal-header">
                <h2>🔄 Sincronizar Datos entre Equipos</h2>
                <button class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="modal-form" style="padding: 2rem;">
                <p><strong>Archivo:</strong> ${SYNC_FILENAME}</p>
                <p><strong>Actividades en archivo:</strong> ${newActivities.length}</p>
                <p><strong>Actividades actuales:</strong> ${activities.length}</p>
                <p><strong>Última modificación:</strong> ${new Date(importedData.lastSave).toLocaleString()}</p>
                
                <div style="margin: 2rem 0; padding: 1rem; background: #f0f7ff; border-radius: 8px;">
                    <h3 style="margin-bottom: 1rem;">Selecciona una opción de sincronización:</h3>
                    
                    <div class="sync-options">
                        <label style="display: block; margin-bottom: 1rem; padding: 1rem; border: 2px solid #4CAF50; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="syncOption" value="merge" checked style="margin-right: 10px;">
                            <strong>1. Fusionar</strong> - Mantener todas las actividades (${activities.length + newActivities.length} total)
                            <div style="font-size: 0.9rem; color: #666; margin-top: 5px;">Se añadirán las actividades del archivo a las existentes</div>
                        </label>
                        
                        <label style="display: block; margin-bottom: 1rem; padding: 1rem; border: 2px solid #2196F3; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="syncOption" value="replace" style="margin-right: 10px;">
                            <strong>2. Reemplazar</strong> - Usar solo las actividades del archivo (${newActivities.length} actividades)
                            <div style="font-size: 0.9rem; color: #666; margin-top: 5px;">Se borrarán todas las actividades actuales</div>
                        </label>
                        
                        <label style="display: block; padding: 1rem; border: 2px solid #9C27B0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="syncOption" value="smart" style="margin-right: 10px;">
                            <strong>3. Solo nuevas</strong> - Agregar solo actividades que no existan
                            <div style="font-size: 0.9rem; color: #666; margin-top: 5px;">Evita duplicados basándose en título, fecha y tipo</div>
                        </label>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="button" class="btn-primary" id="confirmSync">Continuar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#confirmSync').addEventListener('click', function() {
        const option = modal.querySelector('input[name="syncOption"]:checked').value;
        performSyncImport(newActivities, option, importedData);
        modal.remove();
    });
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function performSyncImport(newActivities, option, importedData) {
    let message = '';
    let oldCount = activities.length;
    
    switch(option) {
        case 'merge':
            activities = [...activities, ...newActivities];
            message = `Fusión completada: ${oldCount} + ${newActivities.length} = ${activities.length} actividades`;
            break;
            
        case 'replace':
            activities = newActivities;
            message = `Reemplazo completado: ${activities.length} actividades cargadas`;
            break;
            
        case 'smart':
            const existingKeys = new Set();
            activities.forEach(act => {
                const key = `${act.title.toLowerCase()}_${act.date}_${act.type}`;
                existingKeys.add(key);
            });
            
            const uniqueNewActivities = newActivities.filter(act => {
                const key = `${act.title.toLowerCase()}_${act.date}_${act.type}`;
                return !existingKeys.has(key);
            });
            
            activities = [...activities, ...uniqueNewActivities];
            message = `Importación inteligente: ${uniqueNewActivities.length} nuevas actividades agregadas (${newActivities.length - uniqueNewActivities.length} duplicados omitidos)`;
            break;
    }
    
    saveData();
    updateView();
    
    showNotification(message, 'success');
    
    setTimeout(() => {
        alert(`✅ Sincronización completada

Resumen:
• Actividades antes: ${oldCount}
• Actividades después: ${activities.length}
• Diferencia: ${activities.length - oldCount}

${option === 'smart' ? 'Se omitieron actividades duplicadas automáticamente' : ''}

Los datos ahora están disponibles en este equipo.`);
    }, 500);
}

// =============== FUNCIONES EXISTENTES ===============

function updateCurrentDate() {
    const now = new Date();
    const elDate = document.getElementById('currentDate');
    if (elDate) {
        elDate.textContent = now.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

function renderDashboard() {
    const total = activities.length;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pending = activities.filter(a => {
        const date = createDateFromString(a.date);
        date.setHours(0, 0, 0, 0);
        
        const isCurrentMonthYear = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        const isFuture = date >= today;
        
        return isCurrentMonthYear && isFuture;
    }).length;
    
    const highPrio = activities.filter(a => a.priority === 'high').length;

    document.getElementById('dashTotalActivities').textContent = total;
    document.getElementById('dashPending').textContent = pending;
    document.getElementById('dashHighPriority').textContent = highPrio;

    const types = ['actividad', 'reunion', 'efemeride', 'recordatorio'];
    const labels = { actividad: 'Actividades', reunion: 'Reuniones', efemeride: 'Efemérides', recordatorio: 'Recordatorios' };
    const colors = { actividad: '#4CAF50', reunion: '#2196F3', efemeride: '#FF9800', recordatorio: '#9C27B0' };
    
    const chartContainer = document.getElementById('typeDistribution');
    if(chartContainer) {
        chartContainer.innerHTML = '';
        types.forEach(type => {
            const count = activities.filter(a => a.type === type).length;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            const row = document.createElement('div');
            row.className = 'chart-bar-row';
            row.innerHTML = `<div style="width: 80px; font-size: 0.8rem;">${labels[type]}</div><div class="chart-bar-bg"><div class="chart-bar-fill" style="width: ${percentage}%; background: ${colors[type]}"></div></div><div style="width: 30px; text-align: right; font-size: 0.8rem;">${count}</div>`;
            chartContainer.appendChild(row);
        });
    }

    const upcomingContainer = document.getElementById('upcomingList');
    if(upcomingContainer) {
        upcomingContainer.innerHTML = '';
        
        const nextEvents = activities
            .filter(a => {
                const date = createDateFromString(a.date);
                date.setHours(0, 0, 0, 0);
                return date >= today;
            })
            .sort((a,b) => createDateFromString(a.date) - createDateFromString(b.date))
            .slice(0, 5);

        if (nextEvents.length === 0) {
            upcomingContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 10px;">No hay eventos próximos</div>';
        } else {
            nextEvents.forEach(act => {
                const date = createDateFromString(act.date);
                const item = document.createElement('div');
                item.className = 'upcoming-item';
                item.style.borderLeftColor = act.color;
                
                const alarmIndicator = act.alarmMinutes > 0 ? 
                    '<span class="alarm-indicator" title="Tiene alarma configurada"><i class="fas fa-bell"></i></span>' : '';
                
                item.innerHTML = `
                    <div class="upcoming-date">
                        <div>${date.getDate()}</div>
                        <div style="font-size: 0.7rem; font-weight: 400;">${monthNames[date.getMonth()].substring(0,3)}</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.9rem; display: flex; align-items: center;">
                            ${act.title} ${alarmIndicator}
                        </div>
                        <div style="font-size: 0.8rem; color: #666;">${act.time || 'Todo el día'}</div>
                    </div>
                `;
                upcomingContainer.appendChild(item);
            });
        }
    }
    
    updateDuplicateCounter();
}

function updateView() {
    const now = currentDate;
    const elDate = document.getElementById('currentDate');
    const elMonth = document.getElementById('currentMonth');
    
    if(elDate) elDate.textContent = now.toLocaleDateString('es-ES', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
    if(elMonth) elMonth.textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    if (currentView === 'calendar') renderCalendar();
    else if (currentView === 'list') renderList();
    else if (currentView === 'gantt') renderGantt();
    else if (currentView === 'dashboard') renderDashboard();
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if(!grid) return;
    
    grid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    
    for(let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }
    
    for(let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        
        if (dateStr === todayStr) {
            dayEl.classList.add('today');
            dayEl.classList.add('current-day');
        }
        
        dayEl.innerHTML = `<div class="day-number">${day}</div>`;
        
        const dayEvents = activities.filter(a => {
            if (currentFilter !== 'all' && a.type !== currentFilter) return false;
            return compareDates(a.date, dateStr);
        });
        
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events';
        
        dayEvents.slice(0, 4).forEach(ev => {
            const evEl = document.createElement('div');
            evEl.className = 'cal-event';
            evEl.textContent = ev.title;
            evEl.style.backgroundColor = ev.color;
            
            if (ev.alarmMinutes > 0) {
                evEl.classList.add('alarm-active');
                evEl.title = 'Este evento tiene alarma configurada';
            }
            
            evEl.onclick = (e) => {
                e.stopPropagation();
                openModal(ev.id);
            };
            eventsContainer.appendChild(evEl);
        });
        
        if (dayEvents.length > 4) {
            const more = document.createElement('div');
            more.style.fontSize = '0.7rem';
            more.style.color = '#666';
            more.style.textAlign = 'center';
            more.textContent = `+${dayEvents.length - 4} más`;
            eventsContainer.appendChild(more);
        }
        
        dayEl.appendChild(eventsContainer);
        dayEl.onclick = () => openModal(null, dateStr);
        grid.appendChild(dayEl);
    }
}

function renderList() {
    const list = document.getElementById('activitiesList');
    if(!list) return;
    
    list.innerHTML = '';
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const sortType = document.getElementById('sortSelect')?.value || 'date';

    let filtered = activities.filter(a => {
        if (currentFilter !== 'all' && a.type !== currentFilter) return false;
        return a.title.toLowerCase().includes(searchTerm) || (a.description || '').toLowerCase().includes(searchTerm);
    });

    filtered.sort((a, b) => {
        if (sortType === 'date') return createDateFromString(a.date) - createDateFromString(b.date);
        if (sortType === 'priority') {
            const priorityMap = { high: 3, medium: 2, low: 1 };
            return priorityMap[b.priority] - priorityMap[a.priority];
        }
        return a.type.localeCompare(b.type);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">No se encontraron actividades.</div>';
        return;
    }

    const duplicates = findDuplicates();
    const duplicateIds = duplicates.map(d => d.duplicate.id);
    
    filtered.forEach(act => {
        const isDuplicate = duplicateIds.includes(act.id);
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.borderLeftColor = act.color;
        
        if (isDuplicate) {
            item.style.opacity = '0.7';
            item.style.background = 'linear-gradient(90deg, var(--bg-card), rgba(245, 158, 11, 0.1))';
        }
        
        const isChecked = selectedIds.has(act.id) ? 'checked' : '';
        
        const activityDate = createDateFromString(act.date);
        activityDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let statusBadge = '';
        
        if (activityDate < today) {
            statusBadge = '<span style="color: #888; font-size: 0.7rem;">(PASADA)</span>';
        } else if (activityDate.getTime() === today.getTime()) {
            statusBadge = '<span style="color: var(--primary); font-size: 0.7rem;">(HOY)</span>';
        } else {
            statusBadge = '<span style="color: #10b981; font-size: 0.7rem;">(PENDIENTE)</span>';
        }
        
        const alarmBadge = act.alarmMinutes > 0 ? 
            `<span class="alarm-badge" title="Alarma: ${getAlarmText(act.alarmMinutes)}">
                <i class="fas fa-bell"></i> ${getAlarmText(act.alarmMinutes)}
            </span>` : '';
        
        item.innerHTML = `
            <div class="list-checkbox-container">
                <input type="checkbox" class="custom-checkbox" data-id="${act.id}" ${isChecked}>
                ${isDuplicate ? '<span title="Actividad duplicada" style="color: #f59e0b; font-size: 0.8rem;">⚠️</span>' : ''}
                ${act.alarmMinutes > 0 ? '<span class="alarm-indicator" title="Tiene alarma configurada"><i class="fas fa-bell"></i></span>' : ''}
            </div>
            <div class="list-info">
                <h4>${act.title} ${isDuplicate ? '<span style="color: #f59e0b; font-size: 0.8rem;">(DUPLICADO)</span>' : ''} ${statusBadge} ${alarmBadge}</h4>
                <div class="list-meta">
                    <span><i class="fas fa-calendar"></i> ${formatDateFriendly(act.date)}</span>
                    ${act.time ? `<span><i class="fas fa-clock"></i> ${act.time}</span>` : ''}
                    <span style="color: ${act.color}">${typeIcons[act.type] || '📌'} ${typeNames[act.type] || act.type}</span>
                </div>
            </div>
            <button class="btn-text" onclick="openModal('${act.id}')"><i class="fas fa-edit"></i></button>
        `;
        
        list.appendChild(item);
    });

    document.querySelectorAll('.custom-checkbox').forEach(box => {
        box.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            updateEmailButton();
        });
    });
}

// Modal
function openModal(id = null, prefillDate = null) {
    editingId = id;
    const modal = document.getElementById('activityModal');
    const delBtn = document.getElementById('deleteActivity');
    const dupBtn = document.getElementById('duplicateActivity');
    const alarmToggleBtn = document.getElementById('toggleAlarm');
    const alarmSelect = document.getElementById('alarmTime');
    
    if (id) {
        const act = activities.find(a => a.id === id);
        if (!act) return;
        
        document.getElementById('modalTitle').textContent = 'Editar Actividad';
        document.getElementById('activityId').value = act.id;
        document.getElementById('activityTitle').value = act.title;
        document.getElementById('activityDate').value = act.date;
        document.getElementById('activityEndDate').value = act.endDate || '';
        document.getElementById('activityTime').value = act.time || '';
        document.getElementById('activityDescription').value = act.description || '';
        document.getElementById('activityColor').value = act.color;
        document.getElementById('activityPriority').value = act.priority;
        
        const hasAlarm = act.alarmMinutes > 0;
        if (hasAlarm) {
            alarmToggleBtn.innerHTML = '<i class="fas fa-bell"></i> <span>Alarma activada</span>';
            alarmToggleBtn.classList.add('active');
            alarmSelect.disabled = false;
            alarmSelect.value = act.alarmMinutes;
        } else {
            alarmToggleBtn.innerHTML = '<i class="fas fa-bell-slash"></i> <span>Alarma desactivada</span>';
            alarmToggleBtn.classList.remove('active');
            alarmSelect.disabled = true;
            alarmSelect.value = defaultAlarmMinutes;
        }
        
        const radios = document.getElementsByName('activityType');
        radios.forEach(r => {
            if(r.value === act.type) r.checked = true;
        });
        
        delBtn.style.display = 'block';
        dupBtn.style.display = 'block';
    } else {
        document.getElementById('modalTitle').textContent = 'Nueva Actividad';
        document.getElementById('activityForm').reset();
        document.getElementById('activityId').value = '';
        document.getElementById('activityColor').value = '#4CAF50';
        document.getElementById('activityPriority').value = 'medium';
        
        alarmToggleBtn.innerHTML = '<i class="fas fa-bell-slash"></i> <span>Alarma desactivada</span>';
        alarmToggleBtn.classList.remove('active');
        alarmSelect.disabled = true;
        alarmSelect.value = defaultAlarmMinutes;
        
        if (prefillDate) {
            document.getElementById('activityDate').value = prefillDate;
        } else {
            document.getElementById('activityDate').value = new Date().toISOString().split('T')[0];
        }
        
        document.querySelector('input[name="activityType"][value="actividad"]').checked = true;
        delBtn.style.display = 'none';
        dupBtn.style.display = 'none';
    }
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('activityModal').classList.remove('active');
    editingId = null;
}

// Formulario
document.getElementById('activityForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const alarmToggleBtn = document.getElementById('toggleAlarm');
    const alarmSelect = document.getElementById('alarmTime');
    const hasAlarm = alarmToggleBtn.classList.contains('active');
    const alarmMinutes = hasAlarm ? parseInt(alarmSelect.value) : 0;
    
    const formData = {
        id: document.getElementById('activityId').value || Date.now().toString(),
        title: document.getElementById('activityTitle').value,
        type: document.querySelector('input[name="activityType"]:checked').value,
        date: document.getElementById('activityDate').value,
        endDate: document.getElementById('activityEndDate').value || '',
        time: document.getElementById('activityTime').value || '',
        priority: document.getElementById('activityPriority').value,
        description: document.getElementById('activityDescription').value,
        color: document.getElementById('activityColor').value,
        alarmMinutes: alarmMinutes,
        alarmTriggered: false,
        lastAlarmTriggeredDate: ''
    };
    
    if (editingId) {
        const index = activities.findIndex(a => a.id === editingId);
        if (index !== -1) {
            activities[index] = formData;
        }
    } else {
        activities.push(formData);
    }
    
    saveData();
    closeModal();
    updateView();
    showNotification('Actividad guardada', 'success');
});

// Botones del modal
document.getElementById('deleteActivity').addEventListener('click', () => {
    if(confirm('¿Seguro que deseas eliminar esta actividad?')) {
        activities = activities.filter(a => a.id !== editingId);
        selectedIds.delete(editingId);
        saveData();
        closeModal();
        updateView();
        updateEmailButton();
        showNotification('Actividad eliminada', 'success');
    }
});

document.getElementById('duplicateActivity').addEventListener('click', () => {
    const act = activities.find(a => a.id === editingId);
    if(act) {
        const newAct = {...act, id: Date.now().toString(), title: act.title + ' (Copia)'};
        activities.push(newAct);
        saveData();
        closeModal();
        updateView();
        showNotification('Actividad clonada', 'success');
    }
});

// Botón de email
function updateEmailButton() {
    const count = selectedIds.size;
    const btn = document.getElementById('btnEmail');
    const counterSpan = document.getElementById('selectedCount');
    
    if(counterSpan) counterSpan.textContent = count;
    if(btn) btn.disabled = count === 0;
}

document.getElementById('btnEmail').addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    
    const selectedActs = activities
        .filter(a => selectedIds.has(a.id))
        .sort((a, b) => createDateFromString(a.date) - createDateFromString(b.date));
    
    const recipient = "c.cari@nsmquilpue.cl";
    const subject = encodeURIComponent(`📋 Resumen Convivencia Escolar - ${new Date().toLocaleDateString()}`);
    
    let body = "ESTIMADOS,\n\nAdjunto el resumen de las actividades:\n\n====================================\n";
    
    selectedActs.forEach(act => {
        const date = formatDateFriendly(act.date);
        const typeIcon = typeIcons[act.type] || '📌';
        
        const priorityIcon = act.priority === 'high' ? '🔴 ALTA' : 
                           act.priority === 'medium' ? '🟡 MEDIA' : '🟢 BAJA';
        
        const alarmInfo = act.alarmMinutes > 0 ? `⏰ Alarma: ${getAlarmText(act.alarmMinutes)} antes\n` : '';
        
        body += `${typeIcon} ${act.title.toUpperCase()}\n`;
        body += `📅 ${date} ${act.time ? '| 🕒 ' + act.time : ''}\n`;
        body += alarmInfo;
        body += `⚡ Prioridad: ${priorityIcon}\n`;
        
        if (act.description) {
            body += `📝 Detalle: ${act.description}\n`;
        }
        
        body += "------------------------------------\n";
    });
    
    body += `\nTotal: ${selectedActs.length}\nGenerado por Sistema de Gestión de Convivencia Escolar.`;
    
    window.open(`mailto:${recipient}?subject=${subject}&body=${encodeURIComponent(body)}`);
});

// Configurar event listeners
function setupEventListeners() {
    // Navegación
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentView = btn.dataset.view;
            document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
            document.getElementById(currentView + 'View').classList.add('active');
            
            updateView();
            
            if(window.innerWidth <= 900) {
                document.getElementById('sidebar').classList.remove('open');
            }
        });
    });

    // Sidebar
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if(window.innerWidth > 900) {
            sidebar.classList.toggle('collapsed');
        } else {
            sidebar.classList.toggle('open');
        }
    });

    // Filtros
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            updateView();
        });
    });

    // Navegación de meses
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        updateView();
        if (currentView === 'gantt') {
            setTimeout(() => {
                const ganttContent = document.getElementById('ganttContent');
                if (ganttContent) {
                    const oldMarkers = ganttContent.querySelectorAll('.gantt-current-day-marker');
                    oldMarkers.forEach(marker => marker.remove());
                    renderGantt();
                }
            }, 50);
        }
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        updateView();
        if (currentView === 'gantt') {
            setTimeout(() => {
                const ganttContent = document.getElementById('ganttContent');
                if (ganttContent) {
                    const oldMarkers = ganttContent.querySelectorAll('.gantt-current-day-marker');
                    oldMarkers.forEach(marker => marker.remove());
                    renderGantt();
                }
            }, 50);
        }
    });

    document.getElementById('today').addEventListener('click', () => {
        currentDate = new Date();
        updateView();
        if (currentView === 'gantt') {
            setTimeout(() => {
                const ganttContent = document.getElementById('ganttContent');
                if (ganttContent) {
                    const oldMarkers = ganttContent.querySelectorAll('.gantt-current-day-marker');
                    oldMarkers.forEach(marker => marker.remove());
                    renderGantt();
                }
            }, 50);
        }
    });

    // Botón nueva actividad
    document.getElementById('addActivity').addEventListener('click', () => openModal());

    // Cerrar modal
    document.querySelectorAll('.modal-close').forEach(b => {
        b.addEventListener('click', closeModal);
    });

    // Tema
    document.getElementById('themeToggle').addEventListener('click', () => {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        document.querySelector('#themeToggle i').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    });

    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (currentView === 'list') renderList();
        });
    }

    // Ordenamiento
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            if (currentView === 'list') renderList();
        });
    }

    // Botón para limpiar duplicados
    document.getElementById('cleanDuplicates').addEventListener('click', () => {
        removeDuplicates();
    });

    document.getElementById('cleanDuplicatesList').addEventListener('click', () => {
        removeDuplicates();
    });

    // Guardar manual
    document.getElementById('backupData').addEventListener('click', () => {
        saveData();
        showNotification('Datos guardados', 'success');
    });

    // Exportar
    document.getElementById('exportData').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            activities: activities,
            version: '2.6',
            lastSave: new Date().toISOString()
        }));
        
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", "convivencia_escolar.json");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        
        showNotification('Datos exportados', 'success');
    });

    // Importar
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('fileImport').click();
    });

    document.getElementById('fileImport').addEventListener('change', handleFileImport);

    // Exportar sincronización
    document.getElementById('exportSync').addEventListener('click', exportSyncFile);
    
    // Importar sincronización
    document.getElementById('importSyncBtn').addEventListener('click', () => {
        document.getElementById('syncFileImport').click();
    });
    
    document.getElementById('syncFileImport').addEventListener('change', importSyncFile);

    // Imprimir
    document.getElementById('generateReport').addEventListener('click', () => {
        if(currentView !== 'list') {
            document.querySelector('[data-view="list"]').click();
        }
        setTimeout(() => window.print(), 500);
    });

    // Ocultar tooltip
    document.addEventListener('click', hideGanttTooltip);
    document.addEventListener('mouseleave', hideGanttTooltip);

    // =============== EVENT LISTENERS PARA ALARMAS ===============
    
    // Toggle de alarma en el modal
    document.getElementById('toggleAlarm').addEventListener('click', () => {
        const btn = document.getElementById('toggleAlarm');
        const select = document.getElementById('alarmTime');
        
        if (btn.classList.contains('active')) {
            btn.innerHTML = '<i class="fas fa-bell-slash"></i> <span>Alarma desactivada</span>';
            btn.classList.remove('active');
            select.disabled = true;
        } else {
            btn.innerHTML = '<i class="fas fa-bell"></i> <span>Alarma activada</span>';
            btn.classList.add('active');
            select.disabled = false;
        }
    });

    // Opciones de alarma en sidebar
    document.querySelectorAll('.alarm-option').forEach(option => {
        option.addEventListener('click', () => {
            const minutes = parseInt(option.dataset.minutes);
            defaultAlarmMinutes = minutes;
            updateAlarmOptionsUI();
            saveAlarmSettings();
            showNotification(`Alarma por defecto configurada a ${getAlarmText(minutes)}`, 'success');
        });
    });

    // Toggle global de alarmas
    document.getElementById('toggleAllAlarms').addEventListener('click', () => {
        globalAlarmsEnabled = !globalAlarmsEnabled;
        updateGlobalAlarmToggle();
        saveAlarmSettings();
        
        if (globalAlarmsEnabled) {
            showNotification('Todas las alarmas han sido activadas', 'success');
            checkAlarms();
        } else {
            showNotification('Todas las alarmas han sido desactivadas', 'info');
        }
    });

    // Botón para probar sonido de alarma
    document.getElementById('testAlarmSound').addEventListener('click', function() {
        playAlarmSound();
        showNotification('Sonido de alarma probado', 'success');
    });
}

// Importar archivo
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const newActivities = Array.isArray(data) ? data : (data.activities || []);
            
            if (newActivities.length === 0) {
                showNotification('El archivo no contiene actividades', 'error');
                return;
            }
            
            if (confirm(`¿Importar ${newActivities.length} actividades? (Se añadirán a las existentes)`)) {
                newActivities.forEach(act => {
                    act.id = Date.now().toString() + Math.random().toString().substr(2, 5);
                    if (act.alarmMinutes === undefined) {
                        act.alarmMinutes = defaultAlarmMinutes;
                    }
                    if (act.alarmTriggered === undefined) {
                        act.alarmTriggered = false;
                    }
                    if (act.lastAlarmTriggeredDate === undefined) {
                        act.lastAlarmTriggeredDate = '';
                    }
                });
                
                activities = [...activities, ...newActivities];
                saveData();
                updateView();
                updateAlarmCount();
                showNotification(`${newActivities.length} actividades importadas`, 'success');
            }
        } catch (error) {
            console.error('Error importando:', error);
            showNotification('Error al importar el archivo', 'error');
        }
    };
    
    if (file.name.endsWith('.json')) {
        reader.readAsText(file);
    } else {
        showNotification('Solo se admiten archivos JSON', 'error');
    }
    
    event.target.value = '';
}

function showNotification(msg, type = 'info') {
    const notif = document.getElementById('notification');
    if (!notif) return;
    
    document.getElementById('notificationText').textContent = msg;
    notif.className = `notification ${type} show`;
    
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}