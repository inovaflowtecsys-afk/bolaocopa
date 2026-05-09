import { supabase } from '../../src/lib/supabase';

const resetPassword = async (userId: string) => {
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: '0102bolaoCop@',
  });

  if (error) throw new Error(error.message);

  const { error: profileError } = await supabase
    .from('users')
    .update({ senha_provisoria: true })
    .eq('id', userId);

  if (profileError) throw new Error(profileError.message);
  return true;
};

export default resetPassword;
