import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import useResetPassword from '@/hooks/admin/useResetPassword';

interface ResetPasswordButtonProps {
  userId: string;
  userName: string;
  disabled?: boolean;
}

const ResetPasswordButton: React.FC<ResetPasswordButtonProps> = ({ userId, userName, disabled }) => {
  const [open, setOpen] = useState(false);
  const { loading, handleResetPassword } = useResetPassword();

  const handleConfirm = async () => {
    await handleResetPassword(userId, userName, () => {
      setOpen(false);
      toast.success('Senha provisoria definida com sucesso.');
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        Reiniciar Senha
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs w-full sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reiniciar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Deseja realmente reiniciar a senha deste usuario?</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800 text-xs">
              A nova senha provisoria sera:
              <br />
              <span className="font-bold">0102bolaoCop@</span>
            </div>
            <div className="text-xs text-slate-600">
              No proximo login, o usuario sera obrigado a cadastrar uma nova senha.
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Processando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResetPasswordButton;
