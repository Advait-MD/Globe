import Stars from "./sky.jsx";
import Signup from "./signup.jsx";
import toast from "react-hot-toast";
import World from "./earth.jsx";
import { useState } from "react";
import Preference from "./prefrence.jsx";

//Login Component

export default function Login(){
 const [page, setPage] = useState("login");

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
      toast.dismiss();
      toast.dismiss
      toast.success("Login successful");
      localStorage.setItem("username", username);
      if(data.hasPreference){
        setTimeout(() => {setPage("World");}, 20);
      }
      else{
        setPage("Preference");
      }
    }
    else{
      toast.dismiss();
      toast.error(data.detail);
    }

  } catch(error){

    console.log(error);
    toast.dismiss();
    toast.error("Server error");
  }
}
    //login rendering
  return(
    <div className="relative h-screen w-screen">
      {page === "login" && (
      <>
    <Stars />
    
    
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
        onClick={() => { toast.dismiss(); setPage("Signup"); }} >
         Don't have an account? Sign Up
      </button>
    </div>
    </div>
    </>
    )}
    {page === "Signup" && (<Signup setPage={setPage} />)}
    {page === "World" && (<World />)}
    {page === "Preference" && (<Preference setPage={setPage}/>)}
    </div>
  );
}