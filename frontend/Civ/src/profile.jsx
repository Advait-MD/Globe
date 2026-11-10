//handles profile preference, logout and account deletion
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { authFetch, clearSession, errorMessage, getUsername } from "./api.js";

const CATEGORIES = ["environment", "sport", "technology"];

export default function Profile({ onPreferenceSaved }){
    const [showProfile, setShowProfile] = useState(false);
    const [preference, setPreference] = useState("");
    const [busy, setBusy] = useState(false);
    const username = getUsername();

   useEffect(() => {
      let cancelled = false;

      //fetch the preference the user already selected during sign up or login
      async function fetchPreference(){
         try{
            const response = await authFetch("/preference");
            const data = await response.json();
            if(response.ok && !cancelled){
               setPreference(data.preference ?? "");
            }
         }
         catch(error){
            console.error(error);
         }
      }
      fetchPreference();
      return () => { cancelled = true; };
   }, []);

//update preference mid session
async function updatePreference(){
   if(busy) return;
   setBusy(true);
   try{
      const response = await authFetch("/preference", {method: "POST", body: JSON.stringify({preference})});
      const data = await response.json();
      toast.dismiss();
      if(response.ok){
         toast.success("Preference updated");
         setShowProfile(false);
         // The globe shows its own loading state while the new feed arrives.
         onPreferenceSaved?.();
      } else {
         toast.error(errorMessage(data));
      }
   } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Server error");
   } finally {
      setBusy(false);
   }
}

//logout
function logout(){
   clearSession();
   window.location.reload();
}

//terminate account of user
async function deleteAccount(){
   if(busy) return;
   setBusy(true);
   try{
      const response = await authFetch("/account", {method: "DELETE"});
      const data = await response.json();
      toast.dismiss();
      if(response.ok){
         toast.success("Account deleted");
         clearSession();
         window.location.reload();
      } else{
         toast.error(errorMessage(data));
      }
   } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Server error");
   } finally {
      setBusy(false);
   }
}

//profile rendering
return(
   <>

      <button onClick={() => setShowProfile(true)}
      className="absolute top-5 right-5 z-20 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-xl hover:bg-white/20 transition">
         {username}
      </button>

      {showProfile && (

         <div onClick={() => setShowProfile(false)} className=" fixed inset-0 flex justify-center items-center bg-black/40 z-50">

            <div onClick={(e) => e.stopPropagation()}
            className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 flex flex-col gap-5 text-white w-[350px] max-w-[90vw]">

               <h1 className="text-2xl font-bold">
                  Profile Settings
               </h1>

               {CATEGORIES.map((cat) => (
                   <label key={cat} className="flex items-center gap-3">
                     <input
                     type="radio" name="profile-preference" value={cat} checked={preference === cat} onChange={(e) =>setPreference(e.target.value)} className="accent-blue-500"/>
                     <span className="capitalize">
                        {cat}
                     </span>
                  </label>
               ))}

               <button onClick={updatePreference} disabled={busy || !preference} className="bg-blue-600 p-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                  Save Preference
               </button>

               <button onClick={logout} className="bg-yellow-600 p-3 rounded-lg hover:bg-yellow-700 transition">
                  Logout
               </button>

               <button onClick={deleteAccount} disabled={busy} className="bg-red-600 p-3 rounded-lg hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                  Delete Account
               </button>

               <button onClick={() => setShowProfile(false)} className="text-gray-300 hover:text-white">
                  Close
               </button>

            </div>
         </div>
      )}
   </>
);
}
