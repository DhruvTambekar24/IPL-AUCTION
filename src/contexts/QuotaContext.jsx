import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const QuotaContext = createContext();

export const QuotaProvider = ({ children }) => {
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [quotaErrorMessage, setQuotaErrorMessage] = useState('');

  const triggerQuotaError = useCallback((message) => {
    setIsQuotaExceeded(true);
    if (message) setQuotaErrorMessage(message);
  }, []);

  const resetQuotaError = useCallback(() => {
    setIsQuotaExceeded(false);
    setQuotaErrorMessage('');
  }, []);

  const handleDatabaseError = useCallback((error) => {
    if (!error) return;
    const errString = String(error.code || error.message || error).toLowerCase();
    if (
      errString.includes('resource-exhausted') ||
      errString.includes('quota') ||
      errString.includes('limit exceeded') ||
      errString.includes('over-quota') ||
      errString.includes('too many requests') ||
      errString.includes('53300') ||
      errString.includes('54000')
    ) {
      triggerQuotaError('Database capacity limit reached. Please try again later.');
    }
  }, [triggerQuotaError]);

  useEffect(() => {
    const checkErrorText = (text) => {
      const lower = String(text || '').toLowerCase();
      if (
        lower.includes('quota') ||
        lower.includes('too many requests') ||
        lower.includes('53300') ||
        lower.includes('54000')
      ) {
        triggerQuotaError('Database capacity limit reached. Please try again later.');
      }
    };

    const handleRejection = (event) => {
      const reason = event.reason;
      checkErrorText(reason?.code || reason?.message || reason);
    };

    const handleError = (event) => {
      checkErrorText(event.error?.code || event.error?.message || event.message);
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, [triggerQuotaError]);

  return (
    <QuotaContext.Provider
      value={{
        isQuotaExceeded,
        quotaErrorMessage,
        triggerQuotaError,
        resetQuotaError,
        handleDatabaseError
      }}
    >
      {children}
    </QuotaContext.Provider>
  );
};

export const useQuota = () => {
  const context = useContext(QuotaContext);
  if (!context) {
    throw new Error('useQuota must be used within a QuotaProvider');
  }
  return context;
};
