import Stars from "./sky.jsx";
import toast from "react-hot-toast";
import {useState} from "react";
import { authFetch, errorMessage } from "./api.js";

export default function Preference({setPage}){
    const category =["environment","sport","technology"];
    const [preference, setPreference] = useState("");
    const [loading, setLoading] = useState(false);
    
   //save user prefrences to the backend, user specific
    async function savePrefrences(event){
     event.preventDefault();
     if(!preference || loading) return;
     try{
     setLoading(true);
     const response = await authFetch("/preference",
    {
      method: "POST",
      body: JSON.stringify({ preference })
    }
  );

  const data = await response.json();

  if(response.ok){
    toast.dismiss();
    toast.success("Preference saved");
    setPage("World");
  }
  else{
    toast.dismiss();
    toast.error(errorMessage(data));
   }
  } catch(error){
    console.error(error);
    toast.dismiss();
    toast.error("Server error");
  } finally {
    setLoading(false);
  }
    }
    return(
        <div className="relative h-screen w-screen">
            <Stars />
            <div className=" absolute inset-0 flex justify-center items-center z-10">
            <form onSubmit={savePrefrences} className=" bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">
                <h1 className="text-3xl font-bold text-white">Preference Page</h1>
                
                {category.map((cat) => (
                     <label key={cat} className="text-white">
                        <input type="radio" name="selpref" value={cat} checked={preference === cat} onChange={(e) => setPreference(e.target.value)}
                        className="h-5 w-5 accent-blue-500" />
                    <span className="capitalize">{cat}</span>
                    </label>
                ))}
                <button type="submit" disabled={!preference || loading} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                    {loading ? "Saving..." : "Save Preference"}
                </button>
            </form>
        </div>
      </div>  
    );
}    
                 