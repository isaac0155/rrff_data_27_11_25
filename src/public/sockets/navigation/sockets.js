const newLink = document.querySelector("#newLink")
const newLinkBtn = document.querySelector("#newLinkBtn")
const newLinkFt = document.querySelector("#newLinkFt")

socket.on("nuevoComunidad", () => {
    try {
        newLink.innerHTML = `
            Links de la Comunidad
            <span class="position-absolute p-1 bg-danger rounded-circle animate__animated animate__headShake">
                <span class="visually-hidden">New alerts</span>
            </span>
        `;
    } catch (error) {
        const a =0
    }
    try {
        newLinkBtn.innerHTML = `
            <span class="navbar-toggler-icon"></span>
            <span class="position-absolute p-1 bg-danger rounded-circle animate__animated animate__headShake">
                <span class="visually-hidden">New alerts</span>
            </span>
        `;
    } catch (error) {
        const a =0
    }
    try {
        newLinkFt.innerHTML = `
            <img src="/img/amigos.png" alt="" width="25" height="25">
            <span class="position-absolute p-1 bg-danger rounded-circle animate__animated animate__headShake">
                <span class="visually-hidden">New alerts</span>
            </span>
        `;
    } catch (error) {
        const a =0
    }
});