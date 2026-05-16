import Openpage from "./globe.jsx";
import { useState } from "react";

//Login Component

export default function Login(){
 const [isSignup, setIsSignup] = useState(false);

 // username and password
 const[username, setUsername] = useState("");
 const[password, setPassword] = useState("");

 if(isSignup){
    return <Signup />;
 }

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
      alert("Login successful");
    }
    else{
      alert(data.detail);
    }

  } catch(error){

    console.log(error);

    alert("Server error");
  }
}
    //login rendering
  return(
    <div className="relative h-screen w-screen">
    
    <Openpage />
    
    
    <div 
    className="absolute inset-0 flex justify-center items-center z-10
    ">
    
     <div
      className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6
      "
    >

     <h1 className="text-3xl font-bold text-center text-blue-600">
        Log In
      </h1>

     <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) =>setUsername(e.target.value)}
        className="border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70"
       />

       <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) =>setPassword(e.target.value)}
        className="border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70
        "
      />

      <button
      onClick={handleLogin}
        className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition
        ">
        Log In
      </button> 

      <button
        className="text-white underline hover:text-blue-400 transition
        "
        onClick={() => setIsSignup(true)}
        >
         Don't have an account? Sign Up
      </button>
    </div>
    </div>
    

    
    </div>
  );
}

//Signup Component

function Signup(){

    const[username, setUsername] = useState("");
    const[password, setPassword] = useState("");

    //sigup function
    async function handleSignup(){

  try{

    const response = await fetch(
      "http://127.0.0.1:8000/signup",
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
      alert("Signup successful");
    }
    else{
      alert(data.detail);
    }

  } catch(error){

    console.log(error);

    alert("Server error");
  }
}

// signup rendering
    return(
        <div className="relative h-screen w-screen">
            <Openpage />
             <div 
    className=" absolute inset-0 flex justify-center items-center z-10
    ">
    
     <div
      className=" bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6
      " 
    >

     <h1 className="text-3xl font-bold text-center text-blue-600">
        Sign Up
      </h1>

     <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className=" border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70
        "
      />

       <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className=" border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-white/70
        "
      />

      <button
      onClick={handleSignup}
        className=" bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition
        ">
        Sign Up
      </button>

    </div>
    </div>
    

    
    </div>
  );
}
    