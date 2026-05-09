import { supabase } from '../../src/lib/supabase';

const forcePasswordChange = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Usuario nao autenticado');

  const { error: profileError } = await supabase
    .from('users')
    .update({ senha_provisoria: false })
    .eq('id', user.id);

  if (profileError) throw new Error(profileError.message);
  return true;
};

export default forcePasswordChange;
