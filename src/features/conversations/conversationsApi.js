import { apiSlice } from "../api/apiSlice";
import { messagesApi } from "../messages/messagesApi";
import io from 'socket.io-client';

export const conversationsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getConversations: builder.query({
            query: (email) =>
                `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,

            transformResponse(apiResponse, meta) {
                const totalCount = meta.response.headers.get("X-Total-Count");
                return {
                    data: apiResponse,
                    totalCount,

                };
            },

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
                    socket.on("conversation", (data) => {
                        updateCachedData((draft) => {
                            const conversation = draft.data.find(
                                // eslint-disable-next-line eqeqeq
                                (c) => c.id == data?.data?.id
                            );

                            if (conversation?.id) {
                                conversation.message = data.data.message;
                                conversation.timestamp = data.data.timestamp;
                            } else {
                                // draft.push(data?.data);
                                console.log('Next Update conversation coming soon...')
                            }
                        });
                    });
                } catch (error) {
                    console.log('Error when added new conversation');
                }
            }
        }),
        getMoreConversations: builder.query({
            query: ({ email, page }) =>
                `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=${page}&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,

            async onQueryStarted({ email }, { queryFulfilled, dispatch }) {
                try {
                    const conversations = await queryFulfilled;
                    if (conversations?.data?.length > 0) {
                        // update conversations cache pessimistically start
                        dispatch(
                            apiSlice.util.updateQueryData("getConversations", email, (draft) => {
                                return {
                                    data: [...draft.data, ...conversations.data],
                                    totalCount: Number(draft.totalCount),
                                };
                            })
                        );
                        // update conversations cache pessimistically end
                    }
                } catch (error) { }
            }
        }),
        getConversation: builder.query({
            query: ({ userEmail, participantEmail }) =>
                `/conversations?participants_like=${userEmail}-${participantEmail}&&participants_like=${participantEmail}-${userEmail}`,
        }),
        addConversation: builder.mutation({
            query: ({ sender, data }) => ({
                url: '/conversations',
                method: 'POST',
                body: data,
            }),
            async onQueryStarted(arg, { queryFulfilled, dispatch }) {
                // optimistic cache update start
                const addPatchResult = dispatch(
                    apiSlice.util.updateQueryData("getConversations", arg.sender, (draft) => {
                        // Push arg.data to the 'draft' array
                        draft.push(arg.data);
                    })
                );

                //  optimistic cache update end
                try {
                    const conversation = await queryFulfilled;
                    if (conversation?.data?.id) {
                        // silent entry  to message table
                        const users = arg.data.users;
                        const senderUser = users.find((user) => user.email === arg.sender);
                        const receiverUser = users.find((user) => user.email !== arg.sender);

                        dispatch(
                            messagesApi.endpoints.addMessage.initiate({
                                conversationId: conversation?.data?.id,
                                sender: senderUser,
                                receiver: receiverUser,
                                message: arg.data.message,
                                timestamp: arg.data.timestamp,
                            })
                        );
                    }
                } catch (error) {
                    addPatchResult.undo();
                }


            }
        }),
        editConversation: builder.mutation({
            query: ({ id, data, sender }) => ({
                url: `/conversations/${id}`,
                method: 'PATCH',
                body: data,
            }),
            async onQueryStarted(arg, { queryFulfilled, dispatch }) {
                // optimistic cache update start
                const editPatchResult = dispatch(
                    apiSlice.util.updateQueryData("getConversations", arg.sender, (draft) => {
                        // eslint-disable-next-line eqeqeq
                        const draftConversation = draft?.data.find((c) => c.id == arg.id);
                        draftConversation.message = arg.data.message;
                        draftConversation.timestamp = arg.data.timestamp;
                    }),
                );
                //  optimistic cache update end

                try {
                    const conversation = await queryFulfilled;
                    if (conversation?.data?.id) {
                        // silent entry  to message table
                        const users = arg.data.users;
                        const senderUser = users.find((user) => user.email === arg.sender);
                        const receiverUser = users.find((user) => user.email !== arg.sender);

                        const res = await dispatch(
                            messagesApi.endpoints.addMessage.initiate({
                                conversationId: conversation?.data?.id,
                                sender: senderUser,
                                receiver: receiverUser,
                                message: arg.data.message,
                                timestamp: arg.data.timestamp,
                            })
                        ).unwrap();

                        // update messages cache pessimistically start
                        dispatch(
                            apiSlice.util.updateQueryData("getMessages", res.conversationId.toString(), (draft) => {
                                draft.push(res);
                            })
                        );
                        // update messages cache pessimistically end

                    }
                } catch (error) {
                    editPatchResult.undo();
                }
            }
        }),
    }),
});

export const { useGetConversationsQuery, useGetConversationQuery, useAddConversationMutation, useEditConversationMutation } = conversationsApi;
