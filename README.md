# Тестовое задание Frontend-разработчик (amoCRM)

Простое одностраничное приложение для отображения сделок из amoCRM с возможностью просмотра детальной информации и статусов задач.

## Что умеет приложение

- Показывает список всех сделок в виде таблицы
- Отображает контакты и телефоны, привязанные к сделкам
- Показывает статусы задач с помощью цветных индикаторов:
   
   🔴 - задача просрочена или отсутствует
  
   🟢 - задача на сегодня
  
   🟡 - задача на будущее
- При клике на сделку показывает подробную информацию
- Соблюдает ограничения API (не более 2-х запросов в секунду)

## Установка и запуск

1. Склонируйте репозиторий:
```bash
git clone [ссылка на репозиторий]
cd amocrm-test
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `config.js` в корневой папке проекта:
```javascript
const config = {
    subdomain: 'ваш-поддомен',
    integrationId: 'ID интеграции',
    secretKey: 'секретный ключ',
    redirectUri: 'https://...',
    authorizationCode: 'код авторизации'
};
```

4. Запустите локальный сервер:
```bash
node server.js
```

5. Откройте в браузере:
```
http://localhost:8080
```

## Как получить данные для config.js

1. Зарегистрируйтесь в [amoCRM](https://www.amocrm.ru/)
2. Перейдите в [amoCRM Маркет](https://www.amocrm.ru/amo-market/)
3. Создайте "Внешнюю интеграцию" через меню (три точки в правом верхнем углу)
4. В настройках интеграции получите:
   - ID интеграции
   - Секретный ключ
   - Код авторизации (вкладка "Ключи и доступы")

## Технологии

- Чистый JavaScript (без фреймворков)
- Bootstrap для стилей
- Express для локального прокси-сервера

## Ограничения API

- Не более 2-х запросов в секунду
- Токен доступа обновляется автоматически через refresh token
- Коды авторизации одноразовые, нужно получать новый при истечении 