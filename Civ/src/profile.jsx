import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function Profile(){
    const [showProfile, setShowProfile] = useState(false);
    const [preference, setPreference] = useState("");
    const username = localStorage.getItem("username");
    
    useEffect(() => {

    async function fetchPreference(){

        try{

            const response = await fetch(
                `http://127.0.0.1:8000/get-preference/${username}`
            );

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

     async function updatePreference(){
        try{
            const response = await fetch("http://127.0.0.1:8000/save-preference",
                {method: "POST",
                    headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({username, preference})
                }

            );
            const data = await response.json();
            if(response.ok){
                toast.dismiss();
                toast.success("Preference updated");
                setShowProfile(false);
                window.location.reload();
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

     function logout(){
        localStorage.removeItem("username");
        window.location.reload();
    }

    async function deleteAccount(){
        try{
            const response = await fetch(`http://127.0.0.1:8000/delete-account/${username}`,
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

    return(

      <>

         <button

            onClick={() =>
               setShowProfile(true)
            }

            className="
               absolute
               top-5
               right-5
               z-20
               bg-white/10
               backdrop-blur-md
               border border-white/20
               text-white
               px-4
               py-2
               rounded-xl
               hover:bg-white/20
               transition
            "
         >

            {username}

         </button>

         {showProfile && (

            <div
               className="
                  absolute
                  inset-0
                  flex
                  justify-center
                  items-center
                  bg-black/40
                  z-30
               "
            >

               <div
                  className="
                     bg-white/10
                     backdrop-blur-md
                     border border-white/20
                     rounded-2xl
                     p-8
                     flex
                     flex-col
                     gap-5
                     text-white
                     min-w-[350px]
                  "
               >

                  <h1 className="text-2xl font-bold">

                     Profile Settings

                  </h1>

                  {[
                     "world",
                     "sport",
                     "technology"
                  ].map((cat) => (

                     <label
                        key={cat}
                        className="
                           flex
                           items-center
                           gap-3
                        "
                     >

                        <input
                           type="radio"

                           value={cat}

                           checked={
                              preference === cat
                           }

                           onChange={(e) =>
                              setPreference(
                                 e.target.value
                              )
                           }

                           className="
                              accent-blue-500
                           "
                        />

                        <span className="capitalize">

                           {cat}

                        </span>

                     </label>

                  ))}

                  <button

                     onClick={updatePreference}

                     className="
                        bg-blue-600
                        p-3
                        rounded-lg
                        hover:bg-blue-700
                        transition
                     "
                  >

                     Save Preference

                  </button>

                  <button

                     onClick={logout}

                     className="
                        bg-yellow-600
                        p-3
                        rounded-lg
                        hover:bg-yellow-700
                        transition
                     "
                  >

                     Logout

                  </button>

                  <button

                     onClick={deleteAccount}

                     className="
                        bg-red-600
                        p-3
                        rounded-lg
                        hover:bg-red-700
                        transition
                     "
                  >

                     Delete Account

                  </button>

                  <button

                     onClick={() =>
                        setShowProfile(false)
                     }

                     className="
                        text-gray-300
                        hover:text-white
                     "
                  >

                     Close

                  </button>

               </div>

            </div>

         )}

      </>

   );
}