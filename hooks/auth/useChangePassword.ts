import { useState } from 'react';
import changePassword from '@/services/auth/changePassword';

const useChangePassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (newPassword: string, onSuccess?: () => void) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await changePassword(newPassword);
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, success, handleChangePassword };
};

export default useChangePassword;
