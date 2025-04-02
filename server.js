const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');

const app = express();

// Включаем CORS
app.use(cors());

// Отдаем статические файлы
app.use(express.static('.'));

// Настраиваем прокси для API amoCRM
const proxy = createProxyMiddleware({
    target: `https://${config.subdomain}.amocrm.ru`,
    changeOrigin: true,
    pathRewrite: {
        '^/api/api/v4': '/api/v4',
        '^/api': ''
    },
    secure: false,
    headers: {
        'Connection': 'keep-alive'
    },
    onProxyReq: (proxyReq, req) => {
        // Сохраняем оригинальные заголовки
        if (req.headers.authorization) {
            proxyReq.setHeader('Authorization', req.headers.authorization);
        }
        
        // Добавляем заголовок для поддержки JSON
        proxyReq.setHeader('Content-Type', 'application/json');
        
        // Логируем запрос для отладки
        console.log('Proxying request:', {
            method: req.method,
            path: req.path,
            headers: proxyReq.getHeaders()
        });
    },
    onProxyRes: (proxyRes, req, res) => {
        // Добавляем CORS заголовки
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
        
        // Логируем ответ для отладки
        console.log('Proxy response:', {
            status: proxyRes.statusCode,
            headers: proxyRes.headers
        });
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).json({ error: 'Proxy Error', message: err.message });
    }
});

// Добавляем обработку OPTIONS запросов
app.options('/api/*', cors());

// Применяем прокси для всех запросов к API
app.use('/api', proxy);

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Прокси настроен для домена: https://${config.subdomain}.amocrm.ru`);
}); 