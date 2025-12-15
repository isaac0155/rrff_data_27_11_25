
const input2 = document.getElementById('pass');
const input3 = document.getElementById('pass2');
const btn = document.querySelector('#btn');

const invalidPass = document.querySelector('#invalidPass');

function verifPass() {
    let x = document.getElementsByName("password")[0].value;
    let y = document.getElementsByName("passwordConfirm")[0].value;

    if (x.length > 4) {
        if (x == y) {
            invalidPass.innerHTML = "Las contraseñas coinciden.";
            input2.className = 'form-control is-valid';
            input3.className = 'form-control is-valid';
            btn.disabled = false;
        } else {
            invalidPass.innerHTML = "Las contraseñas NO coinciden.";
            input2.className = 'form-control is-invalid';
            input3.className = 'form-control is-invalid';
            btn.disabled = true;
        }
    } else {
        invalidPass.innerHTML = "La contraseña debe ser de 5 caracteres o más.";
        input2.className = 'form-control is-invalid';
        btn.disabled = true;
    }
};

