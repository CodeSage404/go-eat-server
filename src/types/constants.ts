/**
 * Notification Message Templates
 */
export const NOTIFICATION_MESSAGES = {
    ORDER: {
        NEW_VENDOR: {
            TITLE: 'New Order Received! 🍔',
            BODY: 'You have a new order waiting to be accepted.',
        },
        STATUS_UPDATE: {
            TITLE: 'Order Update 🛵',
            BODY: (id: string, status: string) => `Your order #${id.substring(0, 6)} is now ${status.replace('_', ' ')}.`,
        },
        RIDER_AVAILABLE: {
            TITLE: 'New Delivery Job Available 📦',
            BODY: 'A new order is ready for pickup near you.',
        },
        RIDER_ASSIGNED: {
            TITLE: 'Rider on the way! 🏍️',
            BODY: 'A courier has been assigned to your order and is heading to the restaurant.',
        },
        RIDER_ARRIVED_RESTAURANT: {
            TITLE: 'Courier at Restaurant 🏪',
            BODY: 'Your rider has arrived at the restaurant to pick up your order.',
        },
        RIDER_ARRIVED_CUSTOMER: {
            TITLE: 'Food is here! 🚪',
            BODY: 'Your courier has arrived at your delivery address. Please meet them at the door!',
        },
        CANCELLED_BY_RESTAURANT: {
            TITLE: 'Order Cancelled ❌',
            BODY: 'We are sorry, but the restaurant had to cancel your order. A refund has been initiated.',
        },
        CANCELLED_BY_CUSTOMER: {
            TITLE: 'Order Cancelled 🗑️',
            BODY: 'Your order has been successfully cancelled.',
        },
        DELAYED: {
            TITLE: 'Small Delay ⏳',
            BODY: 'The restaurant is busier than usual. Your food might take a few extra minutes.',
        },
        DELIVERED: {
            TITLE: 'Enjoy your meal! 😋',
            BODY: 'Your order has been delivered. Don\'t forget to rate your experience!',
        }
    },
    PAYMENT: {
        SUCCESS: {
            TITLE: 'Payment Successful 💳',
            BODY: 'Your payment was processed successfully. We\'re starting on your order now!',
        },
        FAILED: {
            TITLE: 'Payment Failed ⚠️',
            BODY: 'There was an issue with your payment method. Please check and try again.',
        }
    },
    AUTH: {
        WELCOME: {
            TITLE: 'Welcome to Go-eat! 🎉',
            BODY: 'Thanks for joining us. Ready to order some delicious food?',
        },
        OTP_VERIFICATION: {
            TITLE: 'Verification Code 🔐',
            BODY: (otp: string) => `Your Go-eat verification code is ${otp}. Do not share this with anyone.`,
        },
        PASSWORD_CHANGED: {
            TITLE: 'Security Alert 🛡️',
            BODY: 'Your password was recently changed. If this wasn\'t you, please contact support.',
        }
    },
    PROMO: {
        NEW_OFFER: {
            TITLE: 'Flash Sale! 🍕',
            BODY: 'Get 20% off your next order with code G0EAT20. Valid for today only!',
        }
    }
};

/**
 * Socket Event Names
 */
export const SOCKET_EVENTS = {
    // Core System Events
    CONNECT: 'connection',
    DISCONNECT: 'disconnect',
    JOIN: 'join',
    ERROR: 'error',

    // Notification Events
    NOTIFICATION: 'notification',
    NEW_ORDER: 'newOrder',
    ORDER_ACCEPTED: 'orderAccepted',
    ORDER_PREPARING: 'orderPreparing',
    ORDER_READY: 'orderReady',
    ORDER_PICKED_UP: 'orderPickedUp',
    ORDER_DELIVERED: 'orderDelivered',
    ORDER_CANCELLED: 'orderCancelled',
    ORDER_STATUS_UPDATE: 'orderStatusUpdate',
    ORDER_AVAILABLE: 'orderAvailable',
    RIDER_ASSIGNED: 'riderAssigned',
    RIDER_LOCATION_UPDATE: 'riderLocationUpdate',
    RIDER_ARRIVED_AT_RESTAURANT: 'riderArrivedAtRestaurant',
    RIDER_ARRIVED_AT_CUSTOMER: 'riderArrivedAtCustomer',
    PAYMENT_COMPLETED: 'paymentCompleted',
    PAYMENT_FAILED: 'paymentFailed',
    CHAT_MESSAGE: 'chatMessage',
    TYPING: 'typing',
};

/**
 * Common Config Constants
 */
export const APP_CONSTANTS = {
    MAX_RIDER_DISTANCE_METERS: 5000, // 5km
    DEFAULT_PREP_TIME_MINUTES: 20,
};
