(function () {
    const swal = window.Swal;
    if (!swal || swal.__digitalDenToastAdapterInstalled) return;

    const originalFire = swal.fire.bind(swal);
    const notificationIcons = new Set(["success", "error", "warning", "info"]);
    const interactiveOptions = [
        "input",
        "inputOptions",
        "inputValidator",
        "preConfirm",
        "preDeny",
        "showCancelButton",
        "showDenyButton",
        "showLoaderOnConfirm",
        "confirmButtonText",
        "cancelButtonText",
        "denyButtonText"
    ];

    function isNotification(options) {
        return notificationIcons.has(options.icon) &&
            !interactiveOptions.some((key) => options[key]) &&
            options.allowOutsideClick !== false;
    }

    swal.fire = function (...args) {
        let options;

        if (typeof args[0] === "string" && notificationIcons.has(args[2])) {
            options = {
                title: args[0],
                text: args[1],
                icon: args[2]
            };
        } else if (args[0] && typeof args[0] === "object" && isNotification(args[0])) {
            options = args[0];
        } else {
            return originalFire(...args);
        }

        return originalFire({
            ...options,
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            showCloseButton: true,
            timer: options.timer || 15000,
            timerProgressBar: true
        });
    };

    Object.defineProperty(swal, "__digitalDenToastAdapterInstalled", {
        value: true
    });
})();
