import { useState } from 'react';

const useResetPassword = () => {
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (userId: string, userName: string, onSuccess?: () => void) => {
    setLoading(true);

    try {
      const apiUrl = new URL('api/reset-password', window.location.origin + import.meta.env.BASE_URL).toString();

      const res = await fetch(apiUrl, {
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
        const nginx405 =
          res.status === 405 &&
          typeof raw === 'string' &&
          raw.toLowerCase().includes('nginx');

        if (nginx405) {
          throw new Error(
            'A rota administrativa de reset de senha não está disponível no servidor. Verifique o proxy do Nginx para /api/reset-password e se a API Node está em execução.'
          );
        }

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
