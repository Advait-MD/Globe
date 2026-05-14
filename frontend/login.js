// Google login callback
window.handleCredentialResponse = async function(response) {

  console.log("Google Response:", response);

  // JWT Token
  const token = response.credential;

  // Decode JWT payload
  const payload = JSON.parse(
    atob(token.split(".")[1])
  );

  console.log(payload);

  // User info
  const user = {
    name: payload.name,
    email: payload.email,
    picture: payload.picture
  };

  // Save token + user data
  localStorage.setItem("token", token);

  localStorage.setItem(
    "user",
    JSON.stringify(user)
  );

  // Show user info temporarily
  document.getElementById("user-info").innerHTML = `
    <img src="${user.picture}" width="80">

    <h3>${user.name}</h3>

    <p>${user.email}</p>

    <p>Login Successful</p>
  `;

  // Redirect to globe page
  setTimeout(() => {
    window.location.href = "index.html";
  }, 1500);
};