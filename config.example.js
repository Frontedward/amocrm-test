const config = {
    // Ваш поддомен в amoCRM (например, test.amocrm.ru - указывать только test)
    subdomain: 'your-subdomain',
    
    // ID интеграции из настроек amoCRM
    integrationId: 'your-integration-id',
    
    // Секретный ключ интеграции
    secretKey: 'your-secret-key',
    
    // URI для перенаправления (указанный при создании интеграции)
    redirectUri: 'https://your-redirect-uri.com',
    
    // Код авторизации (получается в интерфейсе amoCRM)
    authorizationCode: 'your-authorization-code',
    
    // Задержка между запросами (в миллисекундах)
    requestDelay: 1000 // 1 секунда между запросами для соблюдения лимитов API
};

// Не забудьте переименовать файл в config.js и заполнить своими данными
module.exports = config; 