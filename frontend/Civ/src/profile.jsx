//handles profile prefrence
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function Profile({ refreshNews }){
    const [showProfile, setShowProfile] = useState(false);
    const [preference, setPreference] = useState("");
    const username = localStorage.getItem("username");
    
   useEffect(() => {
   
      //fetch user prefrences that they have already selected during sign up or login
   async function fetchPreference(){
      try{
      const response = await fetch(`https://globe-2-i1ty.onrender.com/get-preference/${username}`);
      const data = await response.json();
      if(response.ok){
         setPreference(data.preference);
      }
      }
      catch(error){
         console.log(error);
      }
   }
   fetchPreference();
}, []);

//update prefrences mid session 
async function updatePreference(){
   try{const response = await fetch("https://globe-2-i1ty.onrender.com/save-preference",
      {method: "POST",
         headers:{"Content-Type":"application/json"},
         body: JSON.stringify({username, preference})}
   );

   const data = await response.json();
   if(response.ok){
    toast.dismiss();
    toast.success("Preference updated");
    if(window.refreshNews){
      await window.refreshNews();
    }
    setShowProfile(false);
    } else {
      toast.dismiss();
      toast.error(data.detail);
      }
      } catch (error) {
         console.log(error);
         toast.dismiss();
         toast.error("Server error");
        }
}

//logout handel
function logout(){
   localStorage.removeItem("username");
   window.location.reload();
}

//close prof
function closeProfile(){
   window.profileOpen = false;
   setShowProfile(false);
}

//terminate account of user
async function deleteAccount(){
   try{
      const response = await fetch(`https://globe-2-i1ty.onrender.com/delete-account/${username}`,
         {method: "DELETE"});
         const data = await response.json();
         if(response.ok){
            toast.dismiss();
            toast.success("Account deleted");
            localStorage.removeItem("username");
            window.location.reload();
            } else{
                toast.dismiss();
                toast.error(data.detail);
            }
            
        } catch (error) {
         console.log(error);
         toast.dismiss();
         toast.error("Server error");
        }
}

//profile rendering
return(
   <>

      <button onClick={() => {window.profileOpen = true;setShowProfile(true);}}
      className="absolute top-5 right-5 z-20 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-xl hover:bg-white/20 transition">
         {username}
      </button>

      {showProfile && (

         <div onClick={closeProfile} onPointerDown={(e) => e.stopPropagation()} className=" fixed inset-0 flex justify-center items-center bg-black/40 z-50">

            <div onClick={(e) => e.stopPropagation()}
            className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 flex flex-col gap-5 text-white min-w-[350px]">

               <h1 className="text-2xl font-bold">
                  Profile Settings
               </h1>

               {["environment","sport","technology"].map((cat) => (
                   <label key={cat} className="flex items-center gap-3">
                     <input
                     type="radio" value={cat} checked={preference === cat} onChange={(e) =>setPreference(e.target.value)} className="accent-blue-500"/>
                     <span className="capitalize">
                        {cat}
                     </span>
                  </label>
               ))}

               <button onClick={updatePreference} className="bg-blue-600 p-3 rounded-lg hover:bg-blue-700 transition">
                  Save Preference
               </button>

               <button onClick={logout} className="bg-yellow-600 p-3 rounded-lg hover:bg-yellow-700 transition">
                  Logout
               </button>

               <button onClick={deleteAccount} className="bg-red-600 p-3 rounded-lg hover:bg-red-700 transition">
                  Delete Account
               </button>

               <button onClick={closeProfile} className="text-gray-300 hover:text-white">
                  Close
               </button>

            </div>
         </div>
      )}
   </>
);
}