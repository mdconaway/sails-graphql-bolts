function formatError(defaultErrors) {
    return defaultErrors.reduce((formattedErrors, ref) => {
        const originalError = ref.originalError;
        if (originalError) {
            const body = originalError.body;
            const code = body.code;
            const status = code === 'E_VALIDATION' ? 422 : body.status;
            const message = [body.reason];
            const validationErrors = body.invalidAttributes;
            const processedError = {
                code,
                status,
                message,
                validationErrors
            };

            if (validationErrors) {
                Object.keys(validationErrors).forEach(key => {
                    if (Array.isArray(validationErrors[key])) {
                        validationErrors[key].forEach(item => {
                            if (item && item.message) {
                                processedError.message.push(item.message);
                            }
                        });
                    }
                });
            }
            processedError.message = processedError.message.join('|');
            formattedErrors.push(processedError);
        } else {
            formattedErrors.push(ref);
        }

        return formattedErrors;
    }, []);
}

module.exports = formatError;
