import Stars from "./sky.jsx";
//import World from "./earth.jsx";
import toast from "react-hot-toast";
import {useState} from "react";

export default function Preference({setPage}){
    const category =["environment","sport","technology"];
    const [preference, setPreference] = useState("");
    const [loading, setLoading] = useState(false);
    const username = localStorage.getItem("username");
    
    async function savePrefrences(){
 try{
    setLoading(true);
    const response = await fetch(
      "https://globe-2-i1ty.onrender.com/save-preference",
      {
        method: "POST",

        headers:{
          "Content-Type":"application/json"
        },

        body: JSON.stringify({
          username,
          preference: preference
        })
      }
    );

    const data = await response.json();

    if(response.ok){
      toast.dismiss();
      toast.success("Preference saved");

      localStorage.setItem(
        "username",
        username
      );
      setTimeout(() => {
        setPage("World");
      }, 20);
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
    return(
        <div className="relative h-screen w-screen">
            <Stars />
            <div className=" absolute inset-0 flex justify-center items-center z-10">
            <div className=" bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">
                <h1 className="text-3xl font-bold text-white">Preference Page</h1>
                
                {category.map((cat) => (
                     <label key={cat} className="text-white">
                        <input type="radio" name="selpref" value={cat} checked={preference === cat} onChange={(e) => setPreference(e.target.value)}
                        className="h-5 w-5 accent-blue-500" />
                    <span className="capitalize">{cat}</span>
                    </label>
                ))}
                <button onClick={savePrefrences} disabled={!preference || loading} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                    {loading ? "Saving..." : "Save Preference"}
                </button>
            </div>
        </div>
      </div>  
    );
}    
                 