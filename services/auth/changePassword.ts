import { supabase } from '../../src/lib/supabase';

const changePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return true;
};

export default changePassword;
