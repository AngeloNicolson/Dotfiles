const { GLib } = imports.gi;

// Modal state
const modalState = Variable({
    visible: false,
    title: '',
    message: '',
    showSpinner: false,
});

// Function to show modal
globalThis.showModal = (title, message, showSpinner = false) => {
    modalState.value = {
        visible: true,
        title: title,
        message: message,
        showSpinner: showSpinner,
    };
};

// Function to hide modal
globalThis.hideModal = () => {
    modalState.value = {
        ...modalState.value,
        visible: false,
    };
};

const ModalWidget = () => Widget.Box({
    className: 'pomodoro_window',
    vertical: true,
    children: [
        Widget.Label({
            className: 'modal-title',
            label: modalState.bind().as(state => state.title),
        }),
        Widget.Label({
            className: 'modal-message',
            label: modalState.bind().as(state => state.message),
        }),
        Widget.Box({
            className: 'modal-spinner-container',
            visible: modalState.bind().as(state => state.showSpinner),
            hpack: 'center',
            child: Widget.Spinner({
                className: 'modal-spinner',
            }),
        }),
    ],
});

export default (monitor = 0) => Widget.Window({
    name: `modal${monitor}`,
    monitor,
    layer: 'overlay',
    anchor: ['top', 'bottom', 'left', 'right'],
    keymode: 'none',
    visible: modalState.bind().as(state => state.visible),
    child: Widget.Overlay({
        child: Widget.Box({
            css: 'background-color: rgba(0, 0, 0, 0.5);',
        }),
        overlays: [
            Widget.Box({
                vpack: 'center',
                hpack: 'center',
                child: monitor === 0 ? ModalWidget() : Widget.Box(),
            }),
        ],
    }),
});
