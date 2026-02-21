function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = data 
        ? `[${timestamp}] ${level}: ${message} ${JSON.stringify(data)}`
        : `[${timestamp}] ${level}: ${message}`;
    
    console.log(logMessage);
}

module.exports = {
    info: (message, data) => log('INFO', message, data),
    error: (message, data) => log('Error', message, data),
    success: (message, data) => log('Success', message, data),
    debug: (message, data) => log('DEBUG', message, data)
};
