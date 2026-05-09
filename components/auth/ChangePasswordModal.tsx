import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import useChangePassword from '@/hooks/auth/useChangePassword';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { loading, error, success, handleChangePassword } = useChangePassword();

  const isValid = password.length >= MIN_PASSWORD_LENGTH && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    await handleChangePassword(password, onClose);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs w-full sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar Senha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
                autoFocus
                className={password && password.length < MIN_PASSWORD_LENGTH ? 'border-red-500' : ''}
              />
              <button type="button" className="absolute right-2 top-2" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && password.length < MIN_PASSWORD_LENGTH && (
              <span className="text-xs text-red-500">Mínimo {MIN_PASSWORD_LENGTH} caracteres</span>
            )}
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className={confirm && confirm !== password ? 'border-red-500' : ''}
              />
              <button type="button" className="absolute right-2 top-2" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm && confirm !== password && (
              <span className="text-xs text-red-500">As senhas não coincidem</span>
            )}
          </div>
          {error && <span className="text-xs text-red-500">{error}</span>}
          {success && <span className="text-xs text-green-600">Senha alterada com sucesso!</span>}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={!isValid || loading}>
              {loading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordModal;
