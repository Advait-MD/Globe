//signup
import Stars from "./sky.jsx";
//import Preference from "./prefrence";
import toast from "react-hot-toast";
import {useState} from "react";

export default function Signup({setPage}){

  const[username, setUsername] = useState("");
  const[password, setPassword] = useState("");
 
  //sigup function
  async function handleSignup(){
   try{
    const response = await fetch("https://globe-2-i1ty.onrender.com/signup",
      {
        method: "POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({username, password})
      }
    );

    const data = await response.json();

    console.log(data);

    //ok response

    if(response.ok){
      toast.dismiss();
      toast.success("Signup successful");
      localStorage.setItem("username", username);
      setTimeout(() => {
        setPage("Preference");
      },1200);
      
    }
    //problem in response
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
// signup rendering
    return(
      <div className="relative h-screen w-screen">
        <Stars />
      <div className=" absolute inset-0 flex justify-center items-center z-10">
      <div className=" bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">

     <h1 className="text-3xl font-bold text-center text-blue-600">
        Sign Up
     </h1>

     <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className=" border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70"/>
     <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className=" border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70"/>

     <button onClick={handleSignup} className=" bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition">
        Sign Up
    </button>

    </div>
    </div>
    </div>
  );
}
    