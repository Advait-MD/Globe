import Openpage, {World} from "./globe.jsx";
import { useState } from "react";


export default function Sign(){

    const[Globe, setGlobe] = useState(false);

    if(Globe){
        return <World />;
    }
  return(
    <div className="relative h-screen w-screen">
    
    <Openpage />
    
    
    <div 
    className="
    absolute
    inset-0
    flex
    justify-center
    items-center
    z-10
    ">
    
     <div
      className="
        bg-white/10
        backdrop-blur-md
        border border-white/20
        rounded-2xl
        shadow-2xl
        p-10
        flex flex-col
        items-center
        gap-6
      "
    >

     <h1 className="text-3xl font-bold text-center text-blue-600">
        Sign Up
      </h1>

     <input
        placeholder="Username"
        className="
          border
          p-3
          rounded-lg
          outline-none
          focus:ring-2
          focus:ring-blue-400
          text-white
          placeholder:text-white/70
        "
      />

       <input
        type="password"
        placeholder="Password"
        className="
          border
          p-3
          rounded-lg
          outline-none
          focus:ring-2
          focus:ring-blue-400
          text-white
          placeholder:text-white/70
        "
      />

      <button
        className="
          bg-blue-600
          text-white
          p-3
          rounded-lg
          hover:bg-blue-700
          transition
        "
      onClick={() => setGlobe(true)}>
        Create Account
      </button>

    </div>
    </div>
    

    
    </div>
  );
}