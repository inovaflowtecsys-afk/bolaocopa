import { useState } from 'react';

const useResetPassword = () => {
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (userId: string, userName: string, onSuccess?: () => void) => {
    setLoading(true);

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const raw = await res.text();
      let data: { error?: string } | null = null;

      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string };
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || raw || `Erro ${res.status} ao resetar senha`);
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(`Erro ao resetar senha de ${userName}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return { loading, handleResetPassword };
};

export default useResetPassword;
