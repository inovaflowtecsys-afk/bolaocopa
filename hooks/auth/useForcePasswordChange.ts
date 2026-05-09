import { useState } from 'react';
import forcePasswordChange from '@/services/auth/forcePasswordChange';

const useForcePasswordChange = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleForceChangePassword = async (newPassword: string, onSuccess?: () => void) => {
    setLoading(true);
    setError(null);
    try {
      await forcePasswordChange(newPassword);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, handleForceChangePassword };
};

export default useForcePasswordChange;
