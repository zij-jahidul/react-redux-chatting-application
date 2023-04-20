import { apiSlice } from "../api/apiSlice";
import io from 'socket.io-client';

export const messagesApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getMessages: builder.query({
            query: (id) =>
                `/messages?conversationId=${id}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_MESSAGES_PER_PAGE}`,

            async onCacheEntryAdded(arg, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
                // create socket
                const socket = io('http://localhost:9000', {
                    reconnectionDelay: 1000,
                    reconnection: true,
                    reconnectionAttemps: 10,
                    transports: ["websocket"],
                    agent: false,
                    upgrade: false,
                    rejectUnauthorized: false,
                });

                try {
                    await cacheDataLoaded;
                    socket.on("message", (data) => {
                        updateCachedData((draft) => {
                            draft.push(data?.data);
                            // eslint-disable-next-line eqeqeq
                            // m.conversationId == data?.data?.id
                            // const draftMessage = draft.find((m) => console.log(`message id ${JSON.stringify(m.message)}`));
                            // console.log(draftMessage);
                            // if (draftMessage?.id) {
                            //     draftMessage.message = data.data.message;
                            //     draftMessage.timestamp = data.data.timestamp;
                            // } else {
                            //     draft.push(data?.data);
                            // }
                        });
                    });
                } catch (error) {
                    console.log('Error when added new message');
                }
            }

        }),
        addMessage: builder.mutation({
            query: (data) => ({
                url: '/messages',
                method: 'POST',
                body: data,
            })
        }),
    }),
});

export const { useGetMessagesQuery, useAddMessageMutation } = messagesApi;