const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://psbklzpvrolunntszfdm.supabase.co';
const supabaseKey = 'sb_publishable_Dpu25Zx2434HFWc0v4TkPg_ELGDkqrZ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = 'hasherkhano097@gmail.com';
  const password = 'AdminPassword123!';

  console.log(`1. Attempting to sign in to get User ID for ${email}...`);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  let userId;

  if (signInError) {
    if (signInError.message.includes("Invalid login credentials")) {
      console.log("User not found or wrong password. Attempting signup...");
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });
      if (authError) {
        console.error("Signup error:", authError.message);
        return;
      }
      userId = authData.user?.id;
    } else {
      console.error("SignIn error:", signInError.message);
      return;
    }
  } else {
    userId = signInData.user?.id;
  }

  console.log("2. User ID identified:", userId);

  console.log("3. Creating/Updating profile as admin and approved...");
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: email,
      name: 'Hashir Khan (Admin)',
      role: 'admin',
      approved: true
    });

  if (profileError) {
    console.error("Profile creation error:", profileError.message);
    console.log("Tip: Make sure you have run the SQL commands in Supabase to create the 'profiles' table!");
  } else {
    console.log("🎉 SUCCESS! Admin account and profile are ready!");
    console.log("You can now login with:");
    console.log("Email: " + email);
    console.log("Password: " + password);
  }
}

createAdmin();
