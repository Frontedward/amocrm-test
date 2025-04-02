class AmoCRMClient {
    constructor() {
        this.deals = [];
        this.contacts = [];
        this.tasks = new Map(); // Храним задачи для каждой сделки
        this.expandedDealId = null;
        this.requestQueue = [];
        this.lastRequestTime = 0;
        // Сохраняем токены в браузере, чтобы не получать их каждый раз
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.subdomain = config.subdomain;
    }

    async authenticate() {
        try {
            // Сначала пробуем использовать refresh token, если он есть
            if (this.refreshToken) {
                const success = await this.refreshAccessToken();
                if (success) return true;
            }

            // Если рефреш не сработал или его нет - используем код авторизации
            const response = await fetch(`/api/oauth2/access_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: config.integrationId,
                    client_secret: config.secretKey,
                    grant_type: 'authorization_code',
                    code: config.authorizationCode,
                    redirect_uri: config.redirectUri
                })
            });

            const data = await response.json();
            
            if (data.access_token) {
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                // Сохраняем токены, чтобы использовать их в следующий раз
                localStorage.setItem('accessToken', this.accessToken);
                localStorage.setItem('refreshToken', this.refreshToken);
                console.log('Ура! Мы подключились к amoCRM');
                return true;
            } else {
                console.error('Что-то пошло не так при получении токена:', data);
                return false;
            }
        } catch (error) {
            console.error('Не удалось подключиться к amoCRM:', error);
            return false;
        }
    }

    async refreshAccessToken() {
        try {
            const response = await fetch(`/api/oauth2/access_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: config.integrationId,
                    client_secret: config.secretKey,
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken,
                    redirect_uri: config.redirectUri
                })
            });

            const data = await response.json();
            
            if (data.access_token) {
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                // Сохраняем новые токены
                localStorage.setItem('accessToken', this.accessToken);
                localStorage.setItem('refreshToken', this.refreshToken);
                console.log('Токен успешно обновлен');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Ошибка при обновлении токена:', error);
            return false;
        }
    }

    async makeRequest(endpoint, method = 'GET', body = null) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const delay = Math.max(0, config.requestDelay - timeSinceLastRequest);

        await new Promise(resolve => setTimeout(resolve, delay));

        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };

        const options = {
            method,
            headers,
            credentials: 'include'
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`/api${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        this.lastRequestTime = Date.now();
        return response.json();
    }

    async loadDeals() {
        try {
            // Получаем сделки и сразу подтягиваем связанные контакты
            const response = await this.makeRequest('/api/v4/leads?with=contacts');
            if (response._embedded && response._embedded.leads) {
                this.deals = response._embedded.leads;
                
                // Собираем все ID контактов из сделок
                const contactIds = new Set();
                for (const deal of this.deals) {
                    if (deal._embedded && deal._embedded.contacts) {
                        deal._embedded.contacts.forEach(contact => {
                            contactIds.add(contact.id);
                        });
                    }
                }

                // Загружаем подробную инфу о контактах и задачах
                if (contactIds.size > 0) {
                    await this.loadContacts(Array.from(contactIds));
                }
                await this.loadTasks();
                
                this.renderDeals();
            }
        } catch (error) {
            console.error('Не удалось загрузить сделки:', error);
        }
    }

    async loadContacts(contactIds) {
        try {
            // Грузим контакты по 2 штуки (ограничение API)
            this.contacts = [];
            for (let i = 0; i < contactIds.length; i += 2) {
                const batch = contactIds.slice(i, i + 2);
                const queryParams = batch.map(id => `filter[id][]=${id}`).join('&');
                const response = await this.makeRequest(`/api/v4/contacts?${queryParams}`);
                if (response._embedded && response._embedded.contacts) {
                    this.contacts.push(...response._embedded.contacts);
                }
                // Ждем секунду перед следующим запросом
                if (i + 2 < contactIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error('Не удалось загрузить контакты:', error);
        }
    }

    async loadTasks() {
        try {
            // Получаем задачи для всех сделок
            const response = await this.makeRequest('/api/v4/tasks?filter[entity_type]=leads');
            if (response._embedded && response._embedded.tasks) {
                // Группируем задачи по сделкам
                response._embedded.tasks.forEach(task => {
                    const dealId = task.entity_id;
                    if (!this.tasks.has(dealId)) {
                        this.tasks.set(dealId, []);
                    }
                    this.tasks.get(dealId).push(task);
                });
            }
        } catch (error) {
            console.error('Ошибка при загрузке задач:', error);
        }
    }

    getDealTasks(dealId) {
        return this.tasks.get(dealId) || [];
    }

    getNextTask(dealId) {
        const tasks = this.getDealTasks(dealId);
        if (!tasks.length) return null;

        // Сортируем задачи по дате выполнения
        const sortedTasks = tasks
            .filter(task => task.complete_till)
            .sort((a, b) => new Date(a.complete_till) - new Date(b.complete_till));

        return sortedTasks[0] || null;
    }

    getStatusColor(taskDate) {
        if (!taskDate) return 'status-red'; // Если задачи нет - красный

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Переводим дату из timestamp в нормальный формат
        const timestamp = typeof taskDate === 'number' ? taskDate * 1000 : Date.parse(taskDate);
        const task = new Date(timestamp);
        task.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((task - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'status-red';     // Просрочена - красный
        if (diffDays === 0) return 'status-green'; // На сегодня - зеленый
        return 'status-yellow';                    // На будущее - желтый
    }

    renderStatusCircle(taskDate) {
        const color = this.getStatusColor(taskDate);
        return `
            <svg width="20" height="20" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" class="${color}" />
            </svg>
        `;
    }

    formatDate(dateString) {
        // Конвертируем timestamp в миллисекунды если это число
        const timestamp = typeof dateString === 'number' ? dateString * 1000 : Date.parse(dateString);
        const date = new Date(timestamp);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    renderDeals() {
        const tbody = document.getElementById('dealsTableBody');
        tbody.innerHTML = '';

        this.deals.forEach(deal => {
            const contact = this.getContactByDealId(deal.id);
            const nextTask = this.getNextTask(deal.id);
            const row = document.createElement('tr');
            row.className = 'deal-row';
            row.dataset.dealId = deal.id;

            row.innerHTML = `
                <td>${deal.id}</td>
                <td>${deal.name}</td>
                <td>${deal.price || 0}</td>
                <td>
                    ${this.renderStatusCircle(nextTask?.complete_till)}
                    ${nextTask ? this.formatDate(nextTask.complete_till) : 'Нет задачи'}
                </td>
                <td>${contact ? this.getContactPhone(contact) : 'Нет телефона'}</td>
            `;

            row.addEventListener('click', () => this.handleDealClick(deal.id));
            tbody.appendChild(row);
        });
    }

    async handleDealClick(dealId) {
        const tbody = document.getElementById('dealsTableBody');
        const loadingSpinner = document.getElementById('loadingSpinner');
        
        if (this.expandedDealId === dealId) {
            this.renderDeals();
            this.expandedDealId = null;
            return;
        }

        loadingSpinner.classList.remove('d-none');
        const dealDetails = await this.loadDealDetails(dealId);
        loadingSpinner.classList.add('d-none');

        if (dealDetails) {
            this.expandedDealId = dealId;
            this.renderDeals();
            
            const row = document.querySelector(`tr[data-deal-id="${dealId}"]`);
            const expandedDetails = document.createElement('tr');
            const nextTask = this.getNextTask(dealId);
            
            expandedDetails.innerHTML = `
                <td colspan="6">
                    <div class="expanded-details">
                        <h5>Детали сделки</h5>
                        <p>ID: ${dealDetails.id}</p>
                        <p>Название: ${dealDetails.name}</p>
                        <p>Дата создания: ${this.formatDate(dealDetails.created_at)}</p>
                        <p>Статус: ${dealDetails.status_id}</p>
                        <p>
                            Статус задачи: 
                            ${this.renderStatusCircle(nextTask?.complete_till)}
                            ${nextTask ? this.formatDate(nextTask.complete_till) : 'Нет задачи'}
                        </p>
                    </div>
                </td>
            `;
            row.after(expandedDetails);
        }
    }

    getContactByDealId(dealId) {
        const deal = this.deals.find(d => d.id === dealId);
        if (!deal || !deal._embedded || !deal._embedded.contacts) {
            return null;
        }
        
        // Ищем первый контакт, связанный со сделкой
        const dealContact = deal._embedded.contacts[0];
        if (!dealContact) {
            return null;
        }

        // Находим полную информацию о контакте
        return this.contacts.find(c => c.id === dealContact.id);
    }

    getContactPhone(contact) {
        if (!contact || !contact.custom_fields_values) {
            return 'Нет телефона';
        }

        const phoneField = contact.custom_fields_values.find(field => 
            field.field_code === 'PHONE' || field.field_name === 'Телефон'
        );

        if (!phoneField || !phoneField.values || !phoneField.values.length) {
            return 'Нет телефона';
        }

        return phoneField.values[0].value;
    }

    async loadDealDetails(dealId) {
        try {
            const [dealResponse, tasksResponse] = await Promise.all([
                this.makeRequest(`/api/v4/leads/${dealId}`),
                this.makeRequest(`/api/v4/tasks?filter[entity_type]=leads&filter[entity_id]=${dealId}`)
            ]);

            const nextTask = tasksResponse._embedded?.tasks?.length > 0 
                ? tasksResponse._embedded.tasks.sort((a, b) => new Date(a.complete_till) - new Date(b.complete_till))[0]
                : null;

            return {
                ...dealResponse,
                next_task: nextTask
            };
        } catch (error) {
            console.error('Ошибка при загрузке деталей сделки:', error);
            return null;
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    const client = new AmoCRMClient();
    
    // Сначала пытаемся аутентифицироваться
    const isAuthenticated = await client.authenticate();
    
    if (isAuthenticated) {
        // Только после успешной аутентификации загружаем сделки
        await client.loadDeals();
    } else {
        console.error('Не удалось аутентифицироваться. Получите новый код авторизации в amoCRM');
    }
}); 