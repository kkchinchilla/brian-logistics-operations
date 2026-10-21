const loginForm =
    document.querySelector('#login-form');

const errorMessage =
    document.querySelector('#error-message');


loginForm.addEventListener(
    'submit',
    async (event) => {

        event.preventDefault();

        errorMessage.textContent = '';

        const email =
            document.querySelector('#email').value;

        const password =
            document.querySelector('#password').value;


        const { data, error } =
            await db.auth.signInWithPassword({
                email,
                password
            });


        if (error) {

            errorMessage.textContent =
                error.message;

            return;
        }


        const user = data.user;


        const {
            data: profile,
            error: profileError
        } = await db
            .from('profiles')
            .select('display_name, role, active')
            .eq('id', user.id)
            .single();


        if (
            profileError ||
            !profile ||
            !profile.active
        ) {

            await db.auth.signOut();

            errorMessage.textContent =
                '無法讀取使用者資料，或此帳號已停用';

            return;
        }


        if (profile.role === 'dispatcher') {

            window.location.href =
                'ui-attendance.html';

        } else if (profile.role === 'driver') {

            window.location.href =
                'ui-attendance.html';

        } else {

            await db.auth.signOut();

            errorMessage.textContent =
                '無法辨識此帳號的使用者權限';
        }

    }
);