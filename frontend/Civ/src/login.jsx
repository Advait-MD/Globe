// handle login, session restore and which page is shown

import Stars from "./sky.jsx";
import Signup from "./signup.jsx";
import toast from "react-hot-toast";
import World from "./earth.jsx";
import { useEffect, useState } from "react";
import Preference from "./prefrence.jsx";
import { API_URL, authFetch, errorMessage, hasToken, saveSession } from "./api.js";

const INPUT_CLASS = "border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70";

//Login Component

export default function Login(){
 // A saved token means the user was already signed in: restore that session
 // instead of dropping them on the login form after every page refresh.
 const [page, setPage] = useState(() => hasToken() ? "restoring" : "login");

 // username and password
 const[username, setUsername] = useState("");
 const[password, setPassword] = useState("");
 const[submitting, setSubmitting] = useState(false);

 useEffect(() => {
  if(page !== "restoring") return;
  let cancelled = false;

  async function restoreSession(){
   try{
    // An expired or invalid token gets a 401, which authFetch turns into a logout.
    const response = await authFetch("/preference");
    if(!response.ok) throw new Error("restore failed");
    const data = await response.json();
    if(!cancelled) setPage(data.preference ? "World" : "Preference");
   }
   catch(error){
    console.error(error);
    if(!cancelled){
     toast.error("Could not reach the server, please log in again");
     setPage("login");
    }
   }
  }

  restoreSession();
  return () => { cancelled = true; };
 }, [page]);

 //login function
 async function handleLogin(event){
  event.preventDefault();
  if(submitting) return;
  setSubmitting(true);

  try{

    const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    toast.dismiss();
    if(response.ok){
      toast.success("Login successful");
      saveSession(data.access_token, data.username);
      setPage(data.hasPreference ? "World" : "Preference");
    }
    else{
      toast.error(errorMessage(data, "Login failed"));
    }

  } catch(error){

    console.error(error);
    toast.dismiss();
    toast.error("Server error");
  } finally {
    setSubmitting(false);
  }
}
    //login rendering
  return(
    <div className="relative h-screen w-screen">
      {page === "restoring" && (
      <>
        <Stars />
        <div className="absolute inset-0 flex justify-center items-center z-10">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 text-white flex items-center gap-3">
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Signing you back in… the server may take a minute to wake up.
          </div>
        </div>
      </>
      )}
      {page === "login" && (
      <>
    <Stars />

    <div className="absolute inset-0 flex justify-center items-center z-10">

     <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">

     <h1 className="text-3xl font-bold text-center text-blue-600">
        Log In
      </h1>

     <input type="text" placeholder="Username" value={username} autoComplete="username"
        onChange={(e) =>setUsername(e.target.value)}
        className={INPUT_CLASS}/>

    <input type="password" placeholder="Password" value={password} autoComplete="current-password"
        onChange={(e) =>setPassword(e.target.value)}
        className={INPUT_CLASS}/>

      <button type="submit" disabled={submitting}
        className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
        {submitting ? "Logging in…" : "Log In"}
      </button>

      <button type="button"
        className="text-white underline hover:text-blue-400 transition"
        onClick={() => { toast.dismiss(); setPage("Signup"); }} >
         Don&apos;t have an account? Sign Up
      </button>
    </form>
    </div>
    </>
    )}
    {page === "Signup" && (<Signup setPage={setPage} />)}
    {page === "World" && (<World />)}
    {page === "Preference" && (<Preference setPage={setPage}/>)}
    </div>
  );
}
