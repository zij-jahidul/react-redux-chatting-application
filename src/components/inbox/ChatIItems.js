import { useSelector } from "react-redux";
import { useGetConversationsQuery } from "../../features/conversations/conversationsApi";
import ChatItem from "./ChatItem";
import Error from '../ui/Error';
import moment from "moment/moment";
import getPartnerInfo from "../../utils/getPartnerInfo";
import gravatarUrl from "gravatar-url";
import { Link } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";

export default function ChatItems() {
    const { user } = useSelector(state => state.auth) || {};
    const { email } = user || {};
    const { data, isLoading, isError, error } = useGetConversationsQuery(email);

    const { data: conversations, totalCount } = data || {};


    // decide what to render
    let content = null;
    if (isLoading) {
        content = (<li className="m-2 text-center">Loading...</li>);
    } else if (!isLoading && isError) {
        content = (<li className="m-2 text-center"><Error message={error?.data.message} /></li>);
    } else if (!isLoading && !isError && conversations?.length === 0) {
        content = (<li className="m-2 text-center">No Conversation found!</li>);
    } else if (!isLoading && !isError && conversations?.length > 0) {
        content =
            <InfiniteScroll
                dataLength={conversations.length}
                next={() => console.log('Fetching')}
                hasMore={true}
                loader={<h4>Loading...</h4>}
                height={window.innerHeight - 129}
            >
                {conversations.map((conversation) => {
                    const { id, message, timestamp } = conversation;
                    const { email } = user || {};
                    const { name, email: partnerEmail } = getPartnerInfo(conversation.users, email);

                    return (
                        <li key={conversation.id}>
                            <Link to={`/inbox/${id}`}>
                                <ChatItem
                                    key={id}
                                    avatar={gravatarUrl(partnerEmail, {
                                        size: 80
                                    })}
                                    name={name}
                                    lastMessage={message}
                                    lastTime={moment(timestamp).fromNow()}
                                />
                            </Link>

                        </li>

                    )
                })}
            </InfiniteScroll>;
    }

    return <ul> {content} </ul>;
}
