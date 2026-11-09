//signup
import Stars from "./sky.jsx";
import toast from "react-hot-toast";
import {useState} from "react";
import { API_URL, errorMessage, saveSession } from "./api.js";

const INPUT_CLASS = "border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70";

export default function Signup({setPage}){

  const[username, setUsername] = useState("");
  const[password, setPassword] = useState("");
  const[submitting, setSubmitting] = useState(false);

  //signup function
  async function handleSignup(event){
   event.preventDefault();
   if(submitting) return;
   setSubmitting(true);

   try{
    const response = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({username, password})
    });

    const data = await response.json();

    toast.dismiss();
    if(response.ok){
      toast.success("Signup successful");
      saveSession(data.access_token, username);
      setPage("Preference");
    }
    //problem in response
    else{
      toast.error(errorMessage(data, "Signup failed"));
    }

  } catch(error){

    console.error(error);
    toast.dismiss();
    toast.error("Server error");
  } finally {
    setSubmitting(false);
  }
}
// signup rendering
    return(
      <div className="relative h-screen w-screen">
        <Stars />
      <div className=" absolute inset-0 flex justify-center items-center z-10">
      <form onSubmit={handleSignup} className=" bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">

     <h1 className="text-3xl font-bold text-center text-blue-600">
        Sign Up
     </h1>

     <input placeholder="Username" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} className={INPUT_CLASS}/>
     <input type="password" placeholder="Password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} className={INPUT_CLASS}/>

     <button type="submit" disabled={submitting} className=" bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
        {submitting ? "Signing up…" : "Sign Up"}
    </button>

    <button type="button" onClick={() => { toast.dismiss(); setPage("login"); }} className="text-white underline hover:text-blue-400 transition">
        Already have an account? Log In
    </button>

    </form>
    </div>
    </div>
  );
}
