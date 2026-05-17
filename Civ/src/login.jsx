import Openpage from "./globe.jsx";
import Signup from "./signup.jsx";
import {Toaster} from "react-hot-toast";
import toast from "react-hot-toast";
import {World} from "./globe.jsx";
import { useState } from "react";

//Login Component

export default function Login(){
 const [isSignup, setIsSignup] = useState(false);
 const [isLoggedIn, setIsLoggedIn] = useState(false);

 // username and password
 const[username, setUsername] = useState("");
 const[password, setPassword] = useState("");
 //login function

 async function handleLogin(){

  try{

    const response = await fetch(
      "http://127.0.0.1:8000/login",
      {
        method: "POST",

        headers:{
          "Content-Type":"application/json"
        },

        body: JSON.stringify({
          username,
          password
        })
      }
    );

    const data = await response.json();

    console.log(data);

    if(response.ok){
      toast.success("Login successful");
      localStorage.setItem("username", username);
      setIsLoggedIn(true);
    }
    else{
      toast.error(data.detail);
    }

  } catch(error){

    console.log(error);

    toast.error("Server error");
  }
}
    //login rendering
  return(
    <div className="relative h-screen w-screen">
      <Toaster />
    {!isSignup && !isLoggedIn && (
      <>
    <Openpage />
    
    
    <div className="absolute inset-0 flex justify-center items-center z-10">
    
     <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">

     <h1 className="text-3xl font-bold text-center text-blue-600">
        Log In
      </h1>

     <input type="text" placeholder="Username" value={username}
        onChange={(e) =>setUsername(e.target.value)}
        className="border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70"/>

    <input type="password" placeholder="Password" value={password}
        onChange={(e) =>setPassword(e.target.value)}
        className="border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70 "/>

      <button
      onClick={handleLogin}
        className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition">
        Log In
      </button> 

      <button
        className="text-white underline hover:text-blue-400 transition"
        onClick={() => { toast.dismiss(); setIsSignup(true); }} >
         Don't have an account? Sign Up
      </button>
    </div>
    </div>
    </>
    )}
    {isSignup && !isLoggedIn && (<Signup setIsSignup={setIsSignup} setIsLoggedIn={setIsLoggedIn} />)}
    {isLoggedIn && (<World />)}
    </div>
  );
}



 