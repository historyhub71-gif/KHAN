const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://psbklzpvrolunntszfdm.supabase.co';
const supabaseKey = 'sb_publishable_Dpu25Zx2434HFWc0v4TkPg_ELGDkqrZ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const email = 'hasherkhano097@gmail.com';
  console.log(`Checking profile for ${email}...`);

  // We can't directly check Auth without a secret key or signing in, 
  // but we can check the 'profiles' table if RLS allows it or if we use the service role.
  // Since we only have the anon key, we'll try to fetch the profile.
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error("Error fetching profile:", error.message);
  } else {
    console.log("Profile data:", data);
  }
}

checkUser();
